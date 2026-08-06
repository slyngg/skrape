import type { Fetcher } from '../types.js';
export interface HttpFetcherOptions {
    cookie?: string;
    retries?: number;
}
export declare class HttpFetcher implements Fetcher {
    private readonly options;
    constructor(options?: HttpFetcherOptions);
    getPage(url: string): Promise<string>;
    /**
     * Follows redirects manually, one hop at a time, so the cookie decision is
     * re-evaluated against the CURRENT hop's hostname rather than the original
     * URL. This prevents a skool.com -> off-domain redirect from carrying the
     * session cookie to a non-Skool host.
     */
    private fetchFollowingRedirects;
}
