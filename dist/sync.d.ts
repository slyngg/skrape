import type { Db } from './store/db.js';
import type { Fetcher } from './types.js';
export type Outcome = 'ok' | 'skipped' | 'no-video' | 'no-access' | 'unavailable' | 'failed';
export interface Problem {
    outcome: Outcome;
    course: string;
    title: string;
    reason: string;
}
export interface ProgressEvent {
    outcome: Outcome;
    course: string;
    title: string;
    done: number;
    total: number;
}
export interface SyncSummary {
    counts: Record<Outcome, number>;
    problems: Problem[];
    totalWords: number;
}
export interface SyncOptions {
    slug: string;
    outDir: string;
    db: Db;
    fetcher: Fetcher;
    concurrency?: number;
    onProgress?: (event: ProgressEvent) => void;
}
export declare function syncClassroom(options: SyncOptions): Promise<SyncSummary>;
