export declare function profileDir(): string;
export declare function dbPath(): string;
/**
 * Marker file written once the one-time Chrome/Playwright browser install
 * has been confirmed (either found already installed, or installed by us).
 * Its presence lets later runs skip re-probing with a real browser launch.
 */
export declare function chromeMarkerPath(): string;
export declare function ensureRoot(): Promise<void>;
export declare function isLoggedIn(html: string): boolean;
/** A handle callers can use to force-close a launched login context, e.g. on Ctrl+C. */
export interface LoginContextHandle {
    close(): Promise<void>;
}
/**
 * Opens a real, headed Chrome against a persistent profile and waits for the
 * user to sign in by hand. Nothing is typed on their behalf and no credentials
 * are read or stored — the session simply persists in the profile directory
 * for later runs.
 *
 * `onContext`, if given, is invoked with a close() handle as soon as the
 * context launches — callers that need to guarantee the profile lock is
 * released on interruption (e.g. Ctrl+C mid-login) should register it there
 * rather than only closing it at the end of this function.
 */
export declare function login(onContext?: (context: LoginContextHandle) => void): Promise<void>;
