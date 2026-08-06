import type { ContentItem } from '../types.js';
export declare function slugify(text: string, maxLength?: number): string;
export declare function transcriptPath(outDir: string, item: ContentItem, padWidth?: number): string;
export declare function writeTranscript(outDir: string, item: ContentItem, body: string, meta: {
    wordCount: number;
    sourceUrl: string;
}, padWidth?: number): Promise<string>;
