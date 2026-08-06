import React from 'react';
import type { CommunityRef } from '../discover/communities.js';
import type { ProgressEvent, SyncSummary } from '../sync.js';
export interface AppControllers {
    /** Output root directory, e.g. './out' — the community slug is appended. */
    outRoot: string;
    checkLoggedIn: () => Promise<boolean>;
    login: () => Promise<void>;
    discoverCommunities: () => Promise<CommunityRef[] | null>;
    countAccessibleCourses: (slug: string) => Promise<number>;
    runSync: (slug: string, outDir: string, onProgress: (event: ProgressEvent) => void) => Promise<SyncSummary>;
}
/**
 * Caps error text shown in the TUI. Some failures (e.g. a raw Playwright
 * browser-launch error) can be a multi-hundred-line dump — that's useless in
 * a terminal UI and pushes everything else off screen, so keep only the
 * first few lines and a hard character cap.
 */
export declare function truncateErrorText(message: string): string;
export declare function App({ controllers }: {
    controllers: AppControllers;
}): React.JSX.Element;
