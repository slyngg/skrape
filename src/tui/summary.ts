import type { Outcome, SyncSummary } from '../sync.js';

export function formatCountLines(summary: SyncSummary): string[] {
  const lines: string[] = [];
  for (const [outcome, count] of Object.entries(summary.counts) as Array<[Outcome, number]>) {
    if (count > 0) lines.push(`  ${outcome.padEnd(14)} ${count}`);
  }
  return lines;
}

export function formatProblemLines(summary: SyncSummary): string[] {
  return summary.problems.map(
    (problem) => `  [${problem.outcome}] ${problem.course} / ${problem.title}: ${problem.reason}`,
  );
}

/** True when nothing was transcribed at all — the case that must never be
 *  rendered as a cheerful, empty-looking summary. */
export function nothingTranscribed(summary: SyncSummary): boolean {
  return summary.counts.ok === 0 && summary.totalWords === 0;
}

export function formatSummary(summary: SyncSummary, outDir: string): string[] {
  const lines: string[] = [];

  if (nothingTranscribed(summary)) {
    lines.push('Nothing was transcribed.', '');
  }

  lines.push('--- summary ---', ...formatCountLines(summary));
  lines.push(`  ${'words'.padEnd(14)} ${summary.totalWords.toLocaleString('en-US')}`);

  if (summary.problems.length > 0) {
    lines.push('', '--- not transcribed ---', ...formatProblemLines(summary));
  }

  lines.push('', `Output: ${outDir}`);
  return lines;
}
