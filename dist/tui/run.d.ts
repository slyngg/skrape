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
export declare function runGuidedFlow(): Promise<void>;
