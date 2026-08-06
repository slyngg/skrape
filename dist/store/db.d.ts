import type { ContentItem, TranscriptResult } from '../types.js';
export declare function contentHash(item: ContentItem): string;
export interface Db {
    upsertCommunity(slug: string, name: string): void;
    upsertItem(community: string, item: ContentItem): {
        id: string;
        changed: boolean;
    };
    saveTranscript(itemId: string, result: TranscriptResult): void;
    getTranscriptStatus(itemId: string): string | null;
    getTranscriptReason(itemId: string): string | null;
    markSynced(slug: string): void;
    close(): void;
}
export declare function openDb(path: string): Db;
