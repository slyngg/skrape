import type { Fetcher } from '../types.js';
/**
 * A Fetcher that also owns a real Chrome process and must be closed to
 * release it.
 */
export interface CloseableFetcher extends Fetcher {
    close(): Promise<void>;
}
/**
 * ============================================================================
 * INVARIANT: only one Chrome process may hold the persistent profile
 * directory at a time. Chrome enforces this itself (SingletonLock) and
 * aborts a second launch against the same profile. Every operation below
 * that needs a browser always closes whatever browser is currently live
 * (via closeCurrent()) before handing out a new one — so the profile is
 * provably held by at most one Chrome at any instant.
 * ============================================================================
 */
/** A handle callers can use to force-close a launched login context, e.g. on Ctrl+C. */
export interface LoginContextHandle {
    close(): Promise<void>;
}
export interface BrowserLifecycleDeps {
    http: Fetcher;
    isLoggedIn: (html: string) => boolean;
    /** Creates a fresh, not-yet-launched BrowserFetcher over the profile dir. */
    makeBrowserFetcher: () => CloseableFetcher;
    /**
     * The real interactive sign-in flow (headed Chrome, same profile dir).
     * `onContext` is called as soon as the headed browser launches, so the
     * lifecycle can track it and force-close it on SIGINT even while
     * performLogin() is still awaiting the user.
     */
    performLogin: (onContext: (context: LoginContextHandle) => void) => Promise<void>;
}
export interface BrowserLifecycle {
    /**
     * Checks whether the saved profile is already signed in. Owns a
     * short-lived browser for the duration of the check only — the profile is
     * guaranteed free again the instant this call resolves or rejects, so a
     * following login() never collides with it.
     */
    checkLoggedIn(): Promise<boolean>;
    /**
     * Runs the interactive login flow. Closes any browser this lifecycle is
     * currently holding first, so the profile is always free before the real
     * (headed) Chrome launches against it.
     */
    login(): Promise<void>;
    /**
     * Returns the long-lived fetcher used for discovery and sync. Lazily
     * launches one fresh browser behind it on first call and reuses it for
     * every call after that.
     */
    getFetcher(): Fetcher;
    /**
     * Closes whichever browser instance is currently live, if any. Safe to
     * call when nothing was ever created and safe to call more than once.
     */
    cleanup(): Promise<void>;
}
/** True when an error looks like Chrome's "profile already in use" failure. */
export declare function isProfileLockError(error: unknown): boolean;
/**
 * Turns Playwright's multi-hundred-line ProcessSingleton/SingletonLock dump
 * into one short, actionable line. The raw error is kept on `.cause` for
 * non-TUI diagnostics (e.g. `--verbose` logging) rather than shown to the
 * user. Anything else passes through unchanged.
 */
export declare function translateLaunchError(error: unknown): Error;
export declare function createBrowserLifecycle(deps: BrowserLifecycleDeps): BrowserLifecycle;
