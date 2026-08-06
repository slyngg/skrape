import { execFile } from 'node:child_process';
function defaultRun(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
export function defaultRevealDeps() {
    return { run: defaultRun, platform: process.platform, log: (message) => console.log(message) };
}
/** Maps a platform to the OS command that reveals a folder in the file
 *  manager, or null when there's no known one to try. */
function revealCommandFor(platform) {
    switch (platform) {
        case 'darwin':
            return { command: 'open', args: (path) => [path] };
        case 'win32':
            return { command: 'explorer', args: (path) => [path] };
        case 'linux':
            return { command: 'xdg-open', args: (path) => [path] };
        default:
            return null;
    }
}
/**
 * Reveals `outDir` in the OS file manager. Tries the platform-appropriate
 * command; if there isn't one for this platform, or the command fails (not
 * installed, headless environment, etc.), this never throws — it just prints
 * the path instead, so a failed reveal can never crash the TUI.
 */
export async function revealOutputFolder(outDir, deps = defaultRevealDeps()) {
    const reveal = revealCommandFor(deps.platform);
    if (!reveal) {
        deps.log(outDir);
        return;
    }
    try {
        await deps.run(reveal.command, reveal.args(outDir));
    }
    catch {
        deps.log(outDir);
    }
}
