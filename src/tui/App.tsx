import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { SelectList } from './SelectList.js';
import { applyProgress, createProgressState, formatProgressBar, type ProgressState } from './progress.js';
import { formatSummary } from './summary.js';
import { isValidSlug, normalizeSlug } from './slug.js';
import { MENU_ITEMS, nextStepForMenuChoice, type DoneState, type MenuChoice } from './flow.js';
import { revealOutputFolder } from './reveal.js';
import type { CommunityRef } from '../discover/communities.js';
import type { ProgressEvent, SyncSummary } from '../sync.js';

export interface AppControllers {
  /** Output root directory, e.g. './out' — the community slug is appended. */
  outRoot: string;
  checkLoggedIn: () => Promise<boolean>;
  login: () => Promise<void>;
  discoverCommunities: () => Promise<CommunityRef[] | null>;
  countAccessibleCourses: (slug: string) => Promise<number>;
  runSync: (
    slug: string,
    outDir: string,
    onProgress: (event: ProgressEvent) => void,
  ) => Promise<SyncSummary>;
}

type Step =
  | { kind: 'checking-session' }
  | { kind: 'login-needed' }
  | { kind: 'logging-in' }
  | { kind: 'discovering' }
  | { kind: 'picking'; communities: CommunityRef[] }
  | { kind: 'manual-slug'; value: string; error: string | null }
  | { kind: 'counting'; slug: string; name: string }
  | { kind: 'confirming'; slug: string; name: string; courseCount: number; outDir: string }
  | { kind: 'syncing'; slug: string; name: string; courseCount: number; outDir: string; progress: ProgressState }
  | { kind: 'done'; slug: string; name: string; courseCount: number; outDir: string; summary: SyncSummary }
  | { kind: 'error'; message: string };

const MAX_ERROR_LINES = 6;
const MAX_ERROR_CHARS = 800;

/**
 * Caps error text shown in the TUI. Some failures (e.g. a raw Playwright
 * browser-launch error) can be a multi-hundred-line dump — that's useless in
 * a terminal UI and pushes everything else off screen, so keep only the
 * first few lines and a hard character cap.
 */
export function truncateErrorText(message: string): string {
  const lines = message.split('\n');
  const truncatedByLines = lines.length > MAX_ERROR_LINES;
  const limitedLines = lines.slice(0, MAX_ERROR_LINES).join('\n');
  const truncatedByChars = limitedLines.length > MAX_ERROR_CHARS;
  const limited = limitedLines.slice(0, MAX_ERROR_CHARS);
  return truncatedByLines || truncatedByChars ? `${limited}\n… (truncated)` : limited;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return truncateErrorText(message);
}

function ConfirmPrompt({ onConfirm }: { onConfirm: () => void }): React.JSX.Element {
  const { exit } = useApp();
  useInput((input, key) => {
    if (key.return) onConfirm();
    else if (input === 'q' || key.escape) exit();
  });
  return <Text dimColor>[enter] continue    [q] quit</Text>;
}

function ExitPrompt({ label }: { label: string }): React.JSX.Element {
  const { exit } = useApp();
  useInput(() => exit());
  return <Text dimColor>{label}</Text>;
}

function ManualSlugInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}): null {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
    if (input) onChange(value + input);
  });
  return null;
}

export function App({ controllers }: { controllers: AppControllers }): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = React.useState<Step>({ kind: 'checking-session' });

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
  });

  const fail = React.useCallback((error: unknown) => {
    setStep({ kind: 'error', message: errorMessage(error) });
  }, []);

  // Step 1: is the saved Chrome profile signed in?
  React.useEffect(() => {
    if (step.kind !== 'checking-session') return;
    let cancelled = false;
    controllers
      .checkLoggedIn()
      .then((loggedIn) => {
        if (cancelled) return;
        setStep(loggedIn ? { kind: 'discovering' } : { kind: 'login-needed' });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  // Step 1b: the user asked us to open the browser so they can sign in.
  React.useEffect(() => {
    if (step.kind !== 'logging-in') return;
    let cancelled = false;
    controllers
      .login()
      .then(() => {
        if (!cancelled) setStep({ kind: 'discovering' });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  // Step 2: fetch the communities the signed-in user belongs to.
  React.useEffect(() => {
    if (step.kind !== 'discovering') return;
    let cancelled = false;
    controllers
      .discoverCommunities()
      .then((communities) => {
        if (cancelled) return;
        if (communities && communities.length > 0) {
          setStep({ kind: 'picking', communities });
        } else {
          setStep({ kind: 'manual-slug', value: '', error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  const chooseCommunity = React.useCallback((slug: string, name: string) => {
    setStep({ kind: 'counting', slug, name });
  }, []);

  // Step 2b/3: count accessible courses for the confirmation screen.
  React.useEffect(() => {
    if (step.kind !== 'counting') return;
    let cancelled = false;
    const { slug, name } = step;
    controllers
      .countAccessibleCourses(slug)
      .then((courseCount) => {
        if (cancelled) return;
        setStep({ kind: 'confirming', slug, name, courseCount, outDir: `${controllers.outRoot}/${slug}` });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step 4: run the sync, folding progress events into render state.
  React.useEffect(() => {
    if (step.kind !== 'syncing') return;
    let cancelled = false;
    const { slug, name, courseCount, outDir } = step;
    controllers
      .runSync(slug, outDir, (event) => {
        if (cancelled) return;
        setStep((previous) =>
          previous.kind === 'syncing' ? { ...previous, progress: applyProgress(previous.progress, event) } : previous,
        );
      })
      .then((summary) => {
        if (!cancelled) setStep({ kind: 'done', slug, name, courseCount, outDir, summary });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  // Step 5: after a sync finishes, act on the post-summary menu choice —
  // loops back into an earlier step (never nests/recurses; `step` is simply
  // replaced again like every other transition) or performs an in-place
  // side effect that leaves the menu on screen.
  const handleMenuChoice = React.useCallback(
    (done: DoneState, choice: MenuChoice) => {
      if (choice === 'quit') {
        exit();
        return;
      }
      if (choice === 'open-folder') {
        // revealOutputFolder never throws (it falls back to printing the
        // path on failure) — this catch is a last-resort guard so a future
        // change there can never crash the TUI.
        void revealOutputFolder(done.outDir).catch(() => {});
        return;
      }
      const transition = nextStepForMenuChoice(done, choice);
      if (!transition) return;
      if (transition.kind === 'discovering') {
        setStep({ kind: 'discovering' });
      } else {
        setStep({
          kind: 'confirming',
          slug: transition.slug,
          name: transition.name,
          courseCount: transition.courseCount,
          outDir: transition.outDir,
        });
      }
    },
    [exit],
  );

  switch (step.kind) {
    case 'checking-session':
      return <Text>Checking your Skool session…</Text>;

    case 'login-needed':
      return (
        <Box flexDirection="column">
          <Text color="yellow">You are not signed in to Skool.</Text>
          <Text dimColor>Nothing is typed for you — a browser window opens and you sign in yourself.</Text>
          <ConfirmPrompt onConfirm={() => setStep({ kind: 'logging-in' })} />
        </Box>
      );

    case 'logging-in':
      return (
        <Box flexDirection="column">
          <Text>A browser window is open. Sign in there.</Text>
          <Text dimColor>Waiting for you to finish (Ctrl+C to cancel)…</Text>
        </Box>
      );

    case 'discovering':
      return <Text>Looking up the communities you belong to…</Text>;

    case 'picking': {
      const items = [
        ...step.communities.map((community) => ({
          label: `${community.name}  (skool.com/${community.slug})`,
          value: community as CommunityRef | null,
        })),
        { label: 'Enter a slug manually…', value: null },
      ];
      return (
        <Box flexDirection="column">
          <Text>Which community?</Text>
          <SelectList
            items={items}
            onSelect={(value) => {
              if (value === null) setStep({ kind: 'manual-slug', value: '', error: null });
              else chooseCommunity(value.slug, value.name);
            }}
          />
        </Box>
      );
    }

    case 'manual-slug':
      return (
        <Box flexDirection="column">
          <Text>Enter the community slug — the part after skool.com/</Text>
          <Text>
            Slug: {step.value}
            <Text color="gray">█</Text>
          </Text>
          {step.error && <Text color="red">{step.error}</Text>}
          <ManualSlugInput
            value={step.value}
            onChange={(value) => setStep({ kind: 'manual-slug', value, error: null })}
            onSubmit={(value) => {
              const slug = normalizeSlug(value);
              if (!isValidSlug(slug)) {
                setStep({ kind: 'manual-slug', value, error: `"${value}" doesn't look like a valid slug.` });
                return;
              }
              chooseCommunity(slug, slug);
            }}
          />
        </Box>
      );

    case 'counting':
      return <Text>Looking up courses in {step.name}…</Text>;

    case 'confirming':
      return (
        <Box flexDirection="column">
          <Text>Community: {step.name} (skool.com/{step.slug})</Text>
          <Text>Courses found: {step.courseCount}</Text>
          <Text>Output will be written to: {step.outDir}</Text>
          <Text> </Text>
          <ConfirmPrompt
            onConfirm={() =>
              setStep({
                kind: 'syncing',
                slug: step.slug,
                name: step.name,
                courseCount: step.courseCount,
                outDir: step.outDir,
                progress: createProgressState(0),
              })
            }
          />
        </Box>
      );

    case 'syncing': {
      const { progress } = step;
      return (
        <Box flexDirection="column">
          <Text>{formatProgressBar(progress.done, progress.total)}</Text>
          {progress.current && (
            <Text dimColor>
              current: {progress.current.course} / {progress.current.title}
            </Text>
          )}
          <Text dimColor>
            ok {progress.counts.ok}  skipped {progress.counts.skipped}  no-video {progress.counts['no-video']}{' '}
            no-access {progress.counts['no-access']}  unavailable {progress.counts.unavailable}  failed{' '}
            {progress.counts.failed}
          </Text>
        </Box>
      );
    }

    case 'done': {
      const lines = formatSummary(step.summary, step.outDir);
      const done: DoneState = {
        slug: step.slug,
        name: step.name,
        courseCount: step.courseCount,
        outDir: step.outDir,
        summary: step.summary,
      };
      return (
        <Box flexDirection="column">
          {lines.map((line, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={index}>{line || ' '}</Text>
          ))}
          <Text> </Text>
          <Text>What next?</Text>
          <SelectList items={MENU_ITEMS} onSelect={(choice) => handleMenuChoice(done, choice)} />
        </Box>
      );
    }

    case 'error':
      return (
        <Box flexDirection="column">
          <Text color="red">Something went wrong: {step.message}</Text>
          <ExitPrompt label="Press any key to exit." />
        </Box>
      );
  }
}
