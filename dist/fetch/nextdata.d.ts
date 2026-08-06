/**
 * Signals that a page did not yield a parseable payload — the trigger for
 * escalating a route from HTTP to a real browser. Distinct from network errors,
 * which must NOT trigger escalation.
 */
export declare class PayloadParseError extends Error {
    constructor(message: string);
}
export declare function extractNextData(html: string): unknown;
