import type { Outcome, ProgressEvent } from '../sync.js';
export interface ProgressState {
    total: number;
    done: number;
    counts: Record<Outcome, number>;
    current: {
        course: string;
        title: string;
    } | null;
}
export declare function createProgressState(total: number): ProgressState;
/**
 * Pure reducer folding one onProgress event into state. Events arrive out of
 * order from concurrent workers, so `done`/`total` are taken straight from the
 * event (sync.ts already owns and increments that counter atomically) rather
 * than re-derived here, and `current` is simply whichever event was folded in
 * most recently — a stable "last seen" snapshot, not a claim about true
 * completion order.
 */
export declare function applyProgress(state: ProgressState, event: ProgressEvent): ProgressState;
export declare function formatProgressBar(done: number, total: number, width?: number): string;
