export interface VttCue {
    start: string | null;
    text: string;
}
export interface ParsedTranscript {
    text: string;
    wordCount: number;
    cueCount: number;
}
/** Split a VTT body into cues, dropping structural lines and consecutive duplicates. */
export declare function parseCues(vtt: string): VttCue[];
export declare function parseVtt(vtt: string): ParsedTranscript;
