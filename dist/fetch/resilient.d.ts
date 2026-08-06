import type { Fetcher } from '../types.js';
export declare class ResilientFetcher implements Fetcher {
    private readonly http;
    private readonly makeBrowser;
    private readonly isAuthenticated?;
    private readonly escalated;
    private browserPromise;
    private browser;
    constructor(http: Fetcher, makeBrowser: () => Promise<Fetcher>, isAuthenticated?: ((html: string) => boolean) | undefined);
    get escalatedRoutes(): ReadonlySet<string>;
    getPage(url: string): Promise<string>;
}
