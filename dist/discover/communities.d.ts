import type { Fetcher } from '../types.js';
export interface CommunityRef {
    slug: string;
    name: string;
}
/**
 * Best-effort scan of the __NEXT_DATA__ payload's `self` object for the signed-in
 * user's community memberships. Deliberately shape-tolerant rather than hardcoding
 * one exact path: it walks `self` (bounded depth) looking for the first array whose
 * every element matches a "group embed" shape (see asCommunityRef above). Returns
 * null — never a guessed or partial list — when nothing matches, so callers know to
 * fall back to manual slug entry instead of showing a fabricated list.
 */
export declare function extractUserGroups(payload: unknown, maxDepth?: number): CommunityRef[] | null;
/**
 * Fetches skool.com/ through the caller's authenticated fetcher stack and looks
 * for the signed-in user's communities. Returns null (not an empty array) when
 * the page didn't yield a parseable payload or no group-shaped list was found —
 * both are treated the same way by callers: fall back to manual slug entry.
 * A genuine network failure still propagates, distinct from a shape mismatch.
 */
export declare function listUserCommunities(fetcher: Fetcher): Promise<CommunityRef[] | null>;
