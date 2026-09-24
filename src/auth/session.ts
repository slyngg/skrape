import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { extractNextData, PayloadParseError } from '../fetch/nextdata.js';

const ROOT = join(homedir(), '.skool-skrape');

export function profileDir(): string {
  return join(ROOT, 'chrome-profile');
}

export function dbPath(): string {
  return join(ROOT, 'skool.db');
}

/**
 * Marker file written once the one-time Chrome/Playwright browser install
 * has been confirmed (either found already installed, or installed by us).
 * Its presence lets later runs skip re-probing with a real browser launch.
 */
export function chromeMarkerPath(): string {
  return join(ROOT, 'chrome-installed');
}

export async function ensureRoot(): Promise<void> {
  await mkdir(ROOT, { recursive: true });
}

export function isLoggedIn(html: string): boolean {
  try {
    const payload = extractNextData(html) as { props?: { pageProps?: { self?: unknown } } };
    return Boolean(payload?.props?.pageProps?.self);
  } catch (error) {
    if (error instanceof PayloadParseError) return false;
    throw error;
  }
}

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
export async function login(onContext?: (context: LoginContextHandle) => void): Promise<void> {
  await ensureRoot();
  const { chromium } = await import('playwright');
  const context = await chromium.launchPersistentContext(profileDir(), {
    channel: 'chrome',
    headless: false,
  });
  onContext?.(context);

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('https://www.skool.com/login', { waitUntil: 'domcontentloaded' });

  console.log('\nA browser window is open. Sign in to Skool there.');
  console.log('Waiting for you to reach a logged-in page (Ctrl+C to cancel)...\n');

  await page.waitForFunction(
    () => {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el?.textContent) return false;
      try {
        return Boolean(JSON.parse(el.textContent)?.props?.pageProps?.self);
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 0 },
  );

  console.log('Signed in. Session saved, future runs will not need this.');
  await context.close();
}
