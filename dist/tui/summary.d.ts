import type { SyncSummary } from '../sync.js';
export declare function formatCountLines(summary: SyncSummary): string[];
export declare function formatProblemLines(summary: SyncSummary): string[];
/** True when nothing was transcribed at all — the case that must never be
 *  rendered as a cheerful, empty-looking summary. */
export declare function nothingTranscribed(summary: SyncSummary): boolean;
export declare function formatSummary(summary: SyncSummary, outDir: string): string[];
