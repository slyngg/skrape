import type { Fetcher } from '../types.js';
/**
 * Playwright-backed fallback. Playwright is imported dynamically so that users
 * who never hit the fallback never pay its startup cost — and so the package
 * still works if the optional dependency is absent.
 */
export declare class BrowserFetcher implements Fetcher {
    private readonly profileDir;
    private context;
    private contextPromise;
    private closed;
    constructor(profileDir: string);
    private ensureContext;
    getPage(url: string): Promise<string>;
    close(): Promise<void>;
}
