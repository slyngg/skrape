import { listCourses, listLessons } from './discover/skool.js';
import { getTranscript } from './media/index.js';
import { writeTranscript } from './store/markdown.js';
/** Run tasks with a bounded number in flight. */
async function pooled(tasks, limit) {
    const results = new Array(tasks.length);
    let cursor = 0;
    // Clamp to at least 1 worker: a caller passing 0, a negative number, or NaN must never
    // produce a zero-worker pool that silently processes nothing.
    const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 1;
    const workers = Array.from({ length: Math.min(safeLimit, tasks.length) }, async () => {
        while (cursor < tasks.length) {
            const index = cursor++;
            results[index] = await tasks[index]();
        }
    });
    await Promise.all(workers);
    return results;
}
/** Extract a readable message from any thrown value, not just Error instances. */
function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
export async function syncClassroom(options) {
    const { slug, outDir, db, fetcher, concurrency = 4, onProgress } = options;
    const counts = {
        ok: 0, skipped: 0, 'no-video': 0, 'no-access': 0, unavailable: 0, failed: 0,
    };
    const problems = [];
    let totalWords = 0;
    db.upsertCommunity(slug, slug);
    const courses = await listCourses(slug, fetcher);
    const accessible = courses.filter((course) => course.hasAccess);
    for (const locked of courses.filter((course) => !course.hasAccess)) {
        counts['no-access']++;
        problems.push({
            outcome: 'no-access', course: locked.title, title: '(entire course)',
            reason: 'hasAccess is 0 — not entitled, skipped without probing',
        });
    }
    // One course's listing failing (network blip, malformed payload) must not take down the whole
    // sync. Each course's fetch is isolated in its own try/catch so Promise.all can never reject —
    // a failure here is recorded as a course-level 'failed' problem and the rest of the run
    // continues.
    const courseResults = await Promise.all(accessible.map(async (course) => {
        try {
            const { items, skipped } = await listLessons(slug, course, fetcher);
            return { course, items, skipped, error: null };
        }
        catch (error) {
            return { course, items: [], skipped: [], error: errorMessage(error) };
        }
    }));
    const lessonEntries = [];
    for (const { course, items, skipped, error } of courseResults) {
        if (error !== null) {
            counts.failed++;
            problems.push({
                outcome: 'failed', course: course.title, title: '(entire course)',
                reason: `could not list lessons: ${error}`,
            });
            continue;
        }
        // Deviation from brief (see task-10-brief.md DEVIATION note 1): writeTranscript now takes an
        // optional padWidth so filename index prefixes sort lexicographically past 99 items. Compute
        // a width per course, based on that course's own lesson count, and carry it alongside each
        // lesson so it's never looked up by a course-title key that two courses could share.
        const padWidth = Math.max(2, String(items.length).length);
        for (const item of items)
            lessonEntries.push({ item, padWidth });
        // A node that parsed but had no usable title (or was a null/non-object tombstone) must not
        // vanish uncounted — the acceptance criterion is a lesson count. Fold it into 'failed' rather
        // than adding a new Outcome member, which would ripple through the CLI and summary.
        for (const skip of skipped) {
            counts.failed++;
            problems.push({ outcome: 'failed', course: course.title, title: '(skipped node)', reason: skip.reason });
        }
    }
    let done = 0;
    const total = lessonEntries.length;
    const record = (outcome, item, reason) => {
        counts[outcome]++;
        if (reason) {
            problems.push({ outcome, course: item.course ?? '—', title: item.title, reason });
        }
        done++;
        // Progress reporting is cosmetic. A caller's callback throwing must never fail the sync.
        try {
            onProgress?.({ outcome, course: item.course ?? '—', title: item.title, done, total });
        }
        catch {
            // swallow — the caller's callback is not our concern
        }
    };
    // A better-sqlite3 error from any of the three store calls below (disk full, locked db, FK
    // violation) must become a per-lesson 'failed' outcome, not a run-ending rejection: a Promise.all
    // over the worker pool would reject on the first such error while sibling workers are still in
    // flight, and the CLI's finally-block browser.close() would then race a live worker into
    // launching a brand-new Chrome context that nothing ever closes. Wrap every db call here.
    const safeSaveTranscript = (id, result) => {
        try {
            db.saveTranscript(id, result);
            return null;
        }
        catch (error) {
            return `could not save transcript status: ${errorMessage(error)}`;
        }
    };
    await pooled(lessonEntries.map(({ item, padWidth }) => async () => {
        let id;
        try {
            ({ id } = db.upsertItem(slug, item));
        }
        catch (error) {
            // No item id was ever created, so there's nothing further to key a transcript row to —
            // still record the lesson so it isn't silently dropped from the counts.
            return record('failed', item, `could not save item: ${errorMessage(error)}`);
        }
        if (!item.hasAccess)
            return record('no-access', item, 'lesson locked');
        if (!item.videoUrl)
            return record('no-video', item, 'lesson has no video attached');
        let status;
        try {
            status = db.getTranscriptStatus(id);
        }
        catch (error) {
            return record('failed', item, `could not read transcript status: ${errorMessage(error)}`);
        }
        if (status === 'ok')
            return record('skipped', item);
        let result;
        try {
            result = await getTranscript(item.videoUrl, fetcher);
        }
        catch (error) {
            // A provider should never throw, but one bad lesson must not end the run.
            result = { status: 'failed', reason: errorMessage(error), provider: 'unknown' };
        }
        if (result.status === 'ok') {
            // Write the file BEFORE committing the DB row. If the write fails (disk full, permission
            // denied) and the DB already said 'ok', resumability would skip this lesson forever on
            // every future run — a permanent silent data loss. Writing first means the only failure
            // mode is a DB save failing after a successful write, which is harmless: the next run
            // just redoes the lesson and overwrites an identical file.
            try {
                await writeTranscript(outDir, item, result.text, {
                    wordCount: result.wordCount, sourceUrl: result.sourceUrl,
                }, padWidth);
            }
            catch (error) {
                const reason = `could not write transcript file: ${errorMessage(error)}`;
                safeSaveTranscript(id, { status: 'failed', reason, provider: result.provider });
                return record('failed', item, reason);
            }
            const saveError = safeSaveTranscript(id, result);
            if (saveError)
                return record('failed', item, saveError);
            totalWords += result.wordCount;
            return record('ok', item);
        }
        const saveError = safeSaveTranscript(id, result);
        if (saveError)
            return record('failed', item, saveError);
        return record(result.status, item, result.reason);
    }), concurrency);
    db.markSynced(slug);
    return { counts, problems, totalWords };
}
