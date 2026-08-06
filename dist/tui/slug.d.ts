/**
 * Strips a pasted skool.com URL (or a path within one) down to the bare slug,
 * and trims whitespace. Users are told to enter "the part after skool.com/",
 * but pasting the whole URL is common enough to normalize rather than reject.
 */
export declare function normalizeSlug(input: string): string;
export declare function isValidSlug(input: string): boolean;
