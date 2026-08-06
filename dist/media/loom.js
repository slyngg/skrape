import { parseVtt } from '../normalize/vtt.js';
const CAPTIONS_RE = /https:\/\/cdn\.loom\.com\/mediametadata\/captions\/[^"'\\\s]+(?:\\u0026[^"'\\\s]+)*/;
const STATUS_RE = /transcription_status\\?"\s*:\s*\\?"([a-z_]+)/;
const MIN_WORDS = 50;
export function loomIdFromUrl(url) {
    if (!url.includes('loom.com'))
        return null;
    const match = url.match(/loom\.com\/share\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
}
export function extractCaptionsUrl(html) {
    const match = html.match(CAPTIONS_RE);
    if (!match)
        return null;
    return match[0].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
}
export function extractTranscriptionStatus(html) {
    const match = html.match(STATUS_RE);
    return match ? match[1] : null;
}
export async function loomTranscript(videoUrl, fetcher) {
    const id = loomIdFromUrl(videoUrl);
    if (!id)
        return { status: 'unavailable', reason: `not a loom share url: ${videoUrl}`, provider: 'loom' };
    const shareUrl = `https://www.loom.com/share/${id}`;
    let html;
    try {
        html = await fetcher.getPage(shareUrl);
    }
    catch (error) {
        return { status: 'failed', reason: `share page: ${error.message}`, provider: 'loom' };
    }
    const captionsUrl = extractCaptionsUrl(html);
    if (!captionsUrl) {
        const status = extractTranscriptionStatus(html) ?? 'unknown';
        return { status: 'unavailable', reason: `no captions (transcription_status=${status})`, provider: 'loom' };
    }
    let vtt;
    try {
        vtt = await fetcher.getPage(captionsUrl);
    }
    catch (error) {
        return { status: 'failed', reason: `captions: ${error.message}`, provider: 'loom' };
    }
    const parsed = parseVtt(vtt);
    if (parsed.wordCount < MIN_WORDS) {
        return {
            status: 'unavailable',
            reason: `transcript too short to trust (${parsed.wordCount} words)`,
            provider: 'loom',
        };
    }
    return {
        status: 'ok',
        text: parsed.text,
        wordCount: parsed.wordCount,
        provider: 'loom',
        sourceUrl: shareUrl,
    };
}
