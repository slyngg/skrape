/**
 * Playwright-backed fallback. Playwright is imported dynamically so that users
 * who never hit the fallback never pay its startup cost — and so the package
 * still works if the optional dependency is absent.
 */
export class BrowserFetcher {
    profileDir;
    context = null;
    contextPromise = null;
    closed = false;
    constructor(profileDir) {
        this.profileDir = profileDir;
    }
    async ensureContext() {
        if (this.closed) {
            throw new Error('BrowserFetcher is closed — cannot open a new context after close()');
        }
        if (!this.context) {
            try {
                this.contextPromise ??= (async () => {
                    const { chromium } = await import('playwright');
                    return await chromium.launchPersistentContext(this.profileDir, {
                        channel: 'chrome',
                        headless: true,
                    });
                })();
                this.context = await this.contextPromise;
            }
            catch (error) {
                // Clear the promise memo on rejection to allow retries
                this.contextPromise = null;
                throw error;
            }
        }
        return this.context;
    }
    async getPage(url) {
        const context = await this.ensureContext();
        const page = await context.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            return await page.content();
        }
        finally {
            await page.close();
        }
    }
    async close() {
        this.closed = true;
        if (this.context) {
            await this.context.close();
        }
        // Clear both context and its promise memo — no fresh launch is possible after close()
        // since ensureContext() now rejects once `closed` is set.
        this.context = null;
        this.contextPromise = null;
    }
}
