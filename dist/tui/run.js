import React from 'react';
import { render } from 'ink';
import { HttpFetcher } from '../fetch/http.js';
import { BrowserFetcher } from '../fetch/browser.js';
import { isChromeMarkedInstalled, installChromeViaCli, markChromeInstalled, probeChromeLaunchable } from '../fetch/chromeSetup.js';
import { openDb } from '../store/db.js';
import { syncClassroom } from '../sync.js';
import { chromeMarkerPath, dbPath, ensureRoot, isLoggedIn, login, profileDir } from '../auth/session.js';
import { listCourses } from '../discover/skool.js';
import { listUserCommunities } from '../discover/communities.js';
import { App } from './App.js';
import { createBrowserLifecycle } from './browserLifecycle.js';
import { ensureChromeReady } from './chromeSetup.js';
const OUT_ROOT = './out';
/**
 * Runs the guided, no-arguments flow: session check, community picker,
 * confirmation, live sync progress, and a result summary. Owns the db and
 * the browser lifecycle for the whole flow and guarantees both are closed
 * on every exit path — normal completion, an in-flow error, or Ctrl+C.
 *
 * Browser lifetime is delegated to `createBrowserLifecycle` — see the
 * invariant documented there: only one Chrome process may ever hold the
 * profile directory at a time. That's what let the login step below run
 * "for free" here without any direct knowledge of when browsers open or close.
 */
export async function runGuidedFlow() {
    await ensureRoot();
    // First-run browser setup: must complete before the session check below,
    // and before the db/browser lifecycle are created — a failure here leaves
    // nothing to clean up and is safe to retry on the next invocation.
    await ensureChromeReady({
        isConfirmedInstalled: () => isChromeMarkedInstalled(chromeMarkerPath()),
        probeLaunchable: probeChromeLaunchable,
        markInstalled: (executablePath) => markChromeInstalled(chromeMarkerPath(), executablePath),
        installChrome: async (onProgress) => {
            console.log('\nSetting up the browser skrape needs — this happens once, ~150MB.\n');
            await installChromeViaCli(onProgress);
            console.log('\nBrowser setup complete.\n');
            const executablePath = await probeChromeLaunchable();
            if (!executablePath) {
                throw new Error('Chrome installed, but still could not be launched. This usually means a platform-specific ' +
                    'dependency is missing — see the Playwright install output above for details.');
            }
            return executablePath;
        },
    }, (elapsedSeconds) => {
        process.stdout.write(`\r  installing… ${elapsedSeconds}s elapsed`);
    });
    const db = openDb(dbPath());
    const lifecycle = createBrowserLifecycle({
        http: new HttpFetcher(),
        isLoggedIn,
        makeBrowserFetcher: () => new BrowserFetcher(profileDir()),
        performLogin: (onContext) => login(onContext),
    });
    let closed = false;
    const cleanup = async () => {
        if (closed)
            return;
        closed = true;
        try {
            await lifecycle.cleanup();
        }
        catch (error) {
            console.error(`\nWarning: failed to close browser cleanly: ${error.message}`);
        }
        finally {
            db.close();
        }
    };
    const onSigint = () => {
        void cleanup().finally(() => process.exit(130));
    };
    process.on('SIGINT', onSigint);
    const controllers = {
        outRoot: OUT_ROOT,
        checkLoggedIn: async () => lifecycle.checkLoggedIn(),
        login: async () => {
            await lifecycle.login();
        },
        discoverCommunities: async () => listUserCommunities(lifecycle.getFetcher()),
        countAccessibleCourses: async (slug) => {
            const courses = await listCourses(slug, lifecycle.getFetcher());
            return courses.filter((course) => course.hasAccess).length;
        },
        runSync: async (slug, outDir, onProgress) => syncClassroom({ slug, outDir, db, fetcher: lifecycle.getFetcher(), concurrency: 4, onProgress }),
    };
    const { waitUntilExit } = render(React.createElement(App, { controllers }));
    try {
        await waitUntilExit();
    }
    finally {
        process.off('SIGINT', onSigint);
        await cleanup();
    }
}
