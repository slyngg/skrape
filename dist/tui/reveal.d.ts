export interface RevealDeps {
    /** Injectable so tests never spawn a real process. Defaults to
     *  node:child_process's execFile, promisified. */
    run: (command: string, args: string[]) => Promise<void>;
    platform: NodeJS.Platform;
    /** Where to print the path when reveal isn't possible/fails. Defaults to
     *  console.log. */
    log: (message: string) => void;
}
export declare function defaultRevealDeps(): RevealDeps;
/**
 * Reveals `outDir` in the OS file manager. Tries the platform-appropriate
 * command; if there isn't one for this platform, or the command fails (not
 * installed, headless environment, etc.), this never throws — it just prints
 * the path instead, so a failed reveal can never crash the TUI.
 */
export declare function revealOutputFolder(outDir: string, deps?: RevealDeps): Promise<void>;
