import { loomTranscript } from './loom.js';
import type { Fetcher, TranscriptResult } from '../types.js';
export declare function getTranscript(videoUrl: string, fetcher: Fetcher): Promise<TranscriptResult>;
export { loomTranscript };
