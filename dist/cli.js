#!/usr/bin/env node
import { Command } from 'commander';
import { HttpFetcher } from './fetch/http.js';
import { BrowserFetcher } from './fetch/browser.js';
import { ResilientFetcher } from './fetch/resilient.js';
import { openDb } from './store/db.js';
import { syncClassroom } from './sync.js';
import { login, profileDir, dbPath, ensureRoot, isLoggedIn } from './auth/session.js';
const MARKS = {
    ok: '+', skipped: '=', 'no-video': '.', 'no-access': '-', unavailable: '!', failed: 'x',
};
const MAX_CONCURRENCY = 16;
/** Parse the --concurrency flag to a positive integer, or return null if invalid. */
function parseConcurrency(raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1)
        return null;
    return Math.min(n, MAX_CONCURRENCY);
}
const program = new Command();
program.name('skrape').description('Read Skool content instead of watching it');
program
    .command('login')
    .description('Sign in to Skool once; the session is reused by later runs')
    .action(async () => {
    await login();
});
program
    .command('sync')
    .argument('<slug>', 'community slug, e.g. demo from skool.com/demo')
    .option('-o, --out <dir>', 'output directory', './out')
    .option('-c, --concurrency <n>', 'parallel requests', '4')
    .description('Pull a community classroom to disk as transcripts')
    .action(async (slug, options) => {
    const concurrency = parseConcurrency(options.concurrency);
    if (concurrency === null) {
        console.error(`\nInvalid --concurrency value: "${options.concurrency}". ` +
            `Must be a positive integer (capped at ${MAX_CONCURRENCY}).`);
        process.exitCode = 1;
        return;
    }
    await ensureRoot();
    const outDir = `${options.out}/${slug}`;
    const db = openDb(dbPath());
    const browser = new BrowserFetcher(profileDir());
    const fetcher = new ResilientFetcher(new HttpFetcher(), async () => browser, isLoggedIn);
    try {
        const summary = await syncClassroom({
            slug,
            outDir,
            db,
            fetcher,
            concurrency,
            onProgress: (event) => {
                const mark = MARKS[event.outcome] ?? '?';
                console.log(`${mark} [${event.done}/${event.total}] ${event.course.slice(0, 28).padEnd(28)} ${event.title.slice(0, 50)}`);
            },
        });
        console.log('\n--- summary ---');
        for (const [outcome, count] of Object.entries(summary.counts)) {
            if (count > 0)
                console.log(`  ${outcome.padEnd(14)} ${count}`);
        }
        console.log(`  ${'words'.padEnd(14)} ${summary.totalWords.toLocaleString('en-US')}`);
        if (fetcher.escalatedRoutes.size > 0) {
            console.log(`\n  escalated to browser: ${[...fetcher.escalatedRoutes].join(', ')}`);
        }
        if (summary.problems.length > 0) {
            console.log('\n--- not transcribed ---');
            for (const problem of summary.problems) {
                console.log(`  [${problem.outcome}] ${problem.course} / ${problem.title}: ${problem.reason}`);
            }
        }
        console.log(`\nOutput: ${outDir}`);
    }
    catch (error) {
        console.error(`\nSync failed: ${error.message}`);
        if (fetcher.escalatedRoutes.size > 0) {
            console.error(`\n  escalated to browser: ${[...fetcher.escalatedRoutes].join(', ')}`);
            console.error('If this mentions an unexpected payload, the authenticated browser path was already tried ' +
                "for the route(s) above, so Skool's page structure most likely changed rather than the " +
                'session being expired. A fresh `skool login` is still worth trying, but treat it as a ' +
                'secondary guess.');
        }
        else {
            console.error('If this mentions an unexpected payload, your session may have expired — run: skool login. ' +
                "It is also possible Skool's page structure changed; if a retry after login fails the same " +
                'way, that is more likely.');
        }
        process.exitCode = 1;
    }
    finally {
        try {
            await browser.close();
        }
        catch (closeError) {
            // Cosmetic only — do not overwrite a real sync error or change the exit code.
            console.error(`\nWarning: failed to close browser cleanly: ${closeError.message}`);
        }
        finally {
            db.close();
        }
    }
});
/**
 * With no subcommand, launch the guided Ink flow instead of requiring the user
 * to already know a subcommand and a community slug. `skrape login` and
 * `skrape sync <slug>` keep working unchanged as scriptable escape hatches.
 * The TUI module is dynamically imported so plain subcommand invocations
 * never pay for loading ink/react.
 */
async function main() {
    if (process.argv.length <= 2) {
        const { runGuidedFlow } = await import('./tui/run.js');
        await runGuidedFlow();
        return;
    }
    program.parse();
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
