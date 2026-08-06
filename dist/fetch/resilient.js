import { extractNextData, PayloadParseError } from './nextdata.js';
/** Group urls by hostname and first two path segments to distinguish different hosts. */
function routeKey(url) {
    try {
        const parsed = new URL(url);
        const pathPart = parsed.pathname.split('/').slice(0, 3).join('/');
        return `${parsed.hostname}${pathPart}`;
    }
    catch {
        return url;
    }
}
function needsPayload(url) {
    try {
        return new URL(url).hostname.endsWith('skool.com');
    }
    catch {
        return false;
    }
}
export class ResilientFetcher {
    http;
    makeBrowser;
    isAuthenticated;
    escalated = new Set();
    browserPromise = null;
    browser = null;
    constructor(http, makeBrowser, isAuthenticated) {
        this.http = http;
        this.makeBrowser = makeBrowser;
        this.isAuthenticated = isAuthenticated;
    }
    get escalatedRoutes() {
        return this.escalated;
    }
    async getPage(url) {
        const route = routeKey(url);
        if (!this.escalated.has(route)) {
            const html = await this.http.getPage(url); // network errors propagate, no escalation
            if (!needsPayload(url))
                return html;
            try {
                extractNextData(html);
                // The payload parsed structurally, but a logged-out (or redirected) Skool page can
                // still ship a valid __NEXT_DATA__ blob — Next.js renders one either way. A semantic
                // check catches that case and escalates to the authenticated browser too.
                if (!this.isAuthenticated || this.isAuthenticated(html))
                    return html;
                this.escalated.add(route);
            }
            catch (error) {
                if (!(error instanceof PayloadParseError))
                    throw error;
                this.escalated.add(route);
            }
        }
        try {
            this.browserPromise ??= this.makeBrowser();
            this.browser = await this.browserPromise;
        }
        catch (error) {
            // Clear the promise memo on rejection to allow retries
            this.browserPromise = null;
            throw error;
        }
        return this.browser.getPage(url);
    }
}
