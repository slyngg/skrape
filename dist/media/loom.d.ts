import type { Fetcher, TranscriptResult } from '../types.js';
export declare function loomIdFromUrl(url: string): string | null;
export declare function extractCaptionsUrl(html: string): string | null;
export declare function extractTranscriptionStatus(html: string): string | null;
export declare function loomTranscript(videoUrl: string, fetcher: Fetcher): Promise<TranscriptResult>;
