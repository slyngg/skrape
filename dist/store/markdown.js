import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export function slugify(text, maxLength = 60) {
    const cleaned = text
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLength)
        .replace(/-+$/g, '');
    return cleaned || 'untitled';
}
export function transcriptPath(outDir, item, padWidth = 2) {
    const course = slugify(item.course ?? 'uncategorized');
    const width = Math.max(2, padWidth);
    const name = `${String(item.index).padStart(width, '0')}-${slugify(item.title)}.md`;
    return join(outDir, 'transcripts', course, name);
}
export async function writeTranscript(outDir, item, body, meta, padWidth = 2) {
    const path = transcriptPath(outDir, item, padWidth);
    await mkdir(dirname(path), { recursive: true });
    const minutes = Math.round(item.durationMs / 60_000);
    const cleanTitle = item.title.replace(/\s+/g, ' ');
    const cleanCourse = (item.course ?? '—').replace(/\s+/g, ' ');
    const cleanSection = item.section?.replace(/\s+/g, ' ');
    const header = [
        `# ${cleanTitle}`,
        '',
        `> Course: ${cleanCourse}` +
            (cleanSection ? `  |  Section: ${cleanSection}` : '') +
            `  |  ${minutes} min  |  ${meta.wordCount.toLocaleString('en-US')} words`,
        `> Source: ${meta.sourceUrl}`,
        '',
        '---',
        '',
    ].join('\n');
    await writeFile(path, `${header}${body}\n`, 'utf-8');
    return path;
}
