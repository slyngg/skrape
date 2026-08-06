import { ResilientFetcher } from '../fetch/resilient.js';
const LOCK_ERROR_PATTERN = /ProcessSingleton|SingletonLock/i;
/** True when an error looks like Chrome's "profile already in use" failure. */
export function isProfileLockError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return LOCK_ERROR_PATTERN.test(message);
}
/**
 * Turns Playwright's multi-hundred-line ProcessSingleton/SingletonLock dump
 * into one short, actionable line. The raw error is kept on `.cause` for
 * non-TUI diagnostics (e.g. `--verbose` logging) rather than shown to the
 * user. Anything else passes through unchanged.
 */
export function translateLaunchError(error) {
    if (isProfileLockError(error)) {
        const friendly = new Error('The Chrome profile is already in use. Another skrape process may be running — ' +
            'if not, delete ~/.skool-skrape/chrome-profile/SingletonLock and try again.');
        friendly.cause = error;
        return friendly;
    }
    return error instanceof Error ? error : new Error(String(error));
}
function wrapLaunchErrors(browser) {
    return {
        async getPage(url) {
            try {
                return await browser.getPage(url);
            }
            catch (error) {
                throw translateLaunchError(error);
            }
        },
        async close() {
            try {
                await browser.close();
            }
            catch (error) {
                throw translateLaunchError(error);
            }
        },
    };
}
export function createBrowserLifecycle(deps) {
    const { http, isLoggedIn, makeBrowserFetcher, performLogin } = deps;
    // Tracks whichever browser (BrowserFetcher-backed, or the raw login
    // context) currently owns the profile directory, if any. Never held by
    // more than one at a time — see invariant above. At most one of these two
    // is non-null at any instant.
    let current = null;
    let loginContext = null;
    let sharedFetcher = null;
    async function closeCurrent() {
        const browser = current;
        current = null;
        const login = loginContext;
        loginContext = null;
        if (browser)
            await browser.close();
        if (login)
            await login.close();
    }
    return {
        async checkLoggedIn() {
            const browser = wrapLaunchErrors(makeBrowserFetcher());
            current = browser;
            const fetcher = new ResilientFetcher(http, async () => browser, isLoggedIn);
            try {
                const html = await fetcher.getPage('https://www.skool.com/');
                return isLoggedIn(html);
            }
            finally {
                // The check's browser is never reused — always release it here so
                // the profile is free the instant the check is done, whatever the
                // outcome.
                await closeCurrent();
            }
        },
        async login() {
            // Defensive: guarantees the invariant even if a caller invokes login()
            // out of the usual check -> login order.
            await closeCurrent();
            try {
                await performLogin((context) => {
                    loginContext = context;
                });
                // performLogin() already closed its own context on success.
                loginContext = null;
            }
            catch (error) {
                // If a browser did launch before the failure, close it ourselves —
                // otherwise a failed/interrupted login leaves the profile locked
                // for the next run. If SIGINT already closed it (see cleanup()),
                // loginContext is already null here and there is nothing to do.
                const context = loginContext;
                loginContext = null;
                if (context) {
                    await context.close().catch(() => {
                        // Best-effort: we're already reporting the original error.
                    });
                }
                throw translateLaunchError(error);
            }
        },
        getFetcher() {
            if (!sharedFetcher) {
                const browser = wrapLaunchErrors(makeBrowserFetcher());
                current = browser;
                sharedFetcher = new ResilientFetcher(http, async () => browser, isLoggedIn);
            }
            return sharedFetcher;
        },
        cleanup: closeCurrent,
    };
}
