import { loomTranscript } from './loom.js';
/** Host substring -> provider. Add YouTube/Whisper here without touching callers. */
const PROVIDERS = [['loom.com', loomTranscript]];
export async function getTranscript(videoUrl, fetcher) {
    const entry = PROVIDERS.find(([host]) => videoUrl.includes(host));
    if (!entry) {
        return { status: 'unavailable', reason: `unsupported video host: ${videoUrl}`, provider: 'none' };
    }
    return entry[1](videoUrl, fetcher);
}
export { loomTranscript };
