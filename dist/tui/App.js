import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { SelectList } from './SelectList.js';
import { applyProgress, createProgressState, formatProgressBar } from './progress.js';
import { formatSummary } from './summary.js';
import { isValidSlug, normalizeSlug } from './slug.js';
import { MENU_ITEMS, nextStepForMenuChoice } from './flow.js';
import { revealOutputFolder } from './reveal.js';
const MAX_ERROR_LINES = 6;
const MAX_ERROR_CHARS = 800;
/**
 * Caps error text shown in the TUI. Some failures (e.g. a raw Playwright
 * browser-launch error) can be a multi-hundred-line dump — that's useless in
 * a terminal UI and pushes everything else off screen, so keep only the
 * first few lines and a hard character cap.
 */
export function truncateErrorText(message) {
    const lines = message.split('\n');
    const truncatedByLines = lines.length > MAX_ERROR_LINES;
    const limitedLines = lines.slice(0, MAX_ERROR_LINES).join('\n');
    const truncatedByChars = limitedLines.length > MAX_ERROR_CHARS;
    const limited = limitedLines.slice(0, MAX_ERROR_CHARS);
    return truncatedByLines || truncatedByChars ? `${limited}\n… (truncated)` : limited;
}
function errorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    return truncateErrorText(message);
}
function ConfirmPrompt({ onConfirm }) {
    const { exit } = useApp();
    useInput((input, key) => {
        if (key.return)
            onConfirm();
        else if (input === 'q' || key.escape)
            exit();
    });
    return _jsx(Text, { dimColor: true, children: "[enter] continue    [q] quit" });
}
function ExitPrompt({ label }) {
    const { exit } = useApp();
    useInput(() => exit());
    return _jsx(Text, { dimColor: true, children: label });
}
function ManualSlugInput({ value, onChange, onSubmit, }) {
    useInput((input, key) => {
        if (key.return) {
            onSubmit(value);
            return;
        }
        if (key.backspace || key.delete) {
            onChange(value.slice(0, -1));
            return;
        }
        if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow)
            return;
        if (input)
            onChange(value + input);
    });
    return null;
}
export function App({ controllers }) {
    const { exit } = useApp();
    const [step, setStep] = React.useState({ kind: 'checking-session' });
    useInput((input, key) => {
        if (key.ctrl && input === 'c')
            exit();
    });
    const fail = React.useCallback((error) => {
        setStep({ kind: 'error', message: errorMessage(error) });
    }, []);
    // Step 1: is the saved Chrome profile signed in?
    React.useEffect(() => {
        if (step.kind !== 'checking-session')
            return;
        let cancelled = false;
        controllers
            .checkLoggedIn()
            .then((loggedIn) => {
            if (cancelled)
                return;
            setStep(loggedIn ? { kind: 'discovering' } : { kind: 'login-needed' });
        })
            .catch((error) => {
            if (!cancelled)
                fail(error);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step.kind]);
    // Step 1b: the user asked us to open the browser so they can sign in.
    React.useEffect(() => {
        if (step.kind !== 'logging-in')
            return;
        let cancelled = false;
        controllers
            .login()
            .then(() => {
            if (!cancelled)
                setStep({ kind: 'discovering' });
        })
            .catch((error) => {
            if (!cancelled)
                fail(error);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step.kind]);
    // Step 2: fetch the communities the signed-in user belongs to.
    React.useEffect(() => {
        if (step.kind !== 'discovering')
            return;
        let cancelled = false;
        controllers
            .discoverCommunities()
            .then((communities) => {
            if (cancelled)
                return;
            if (communities && communities.length > 0) {
                setStep({ kind: 'picking', communities });
            }
            else {
                setStep({ kind: 'manual-slug', value: '', error: null });
            }
        })
            .catch((error) => {
            if (!cancelled)
                fail(error);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step.kind]);
    const chooseCommunity = React.useCallback((slug, name) => {
        setStep({ kind: 'counting', slug, name });
    }, []);
    // Step 2b/3: count accessible courses for the confirmation screen.
    React.useEffect(() => {
        if (step.kind !== 'counting')
            return;
        let cancelled = false;
        const { slug, name } = step;
        controllers
            .countAccessibleCourses(slug)
            .then((courseCount) => {
            if (cancelled)
                return;
            setStep({ kind: 'confirming', slug, name, courseCount, outDir: `${controllers.outRoot}/${slug}` });
        })
            .catch((error) => {
            if (!cancelled)
                fail(error);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);
    // Step 4: run the sync, folding progress events into render state.
    React.useEffect(() => {
        if (step.kind !== 'syncing')
            return;
        let cancelled = false;
        const { slug, name, courseCount, outDir } = step;
        controllers
            .runSync(slug, outDir, (event) => {
            if (cancelled)
                return;
            setStep((previous) => previous.kind === 'syncing' ? { ...previous, progress: applyProgress(previous.progress, event) } : previous);
        })
            .then((summary) => {
            if (!cancelled)
                setStep({ kind: 'done', slug, name, courseCount, outDir, summary });
        })
            .catch((error) => {
            if (!cancelled)
                fail(error);
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
    const handleMenuChoice = React.useCallback((done, choice) => {
        if (choice === 'quit') {
            exit();
            return;
        }
        if (choice === 'open-folder') {
            // revealOutputFolder never throws (it falls back to printing the
            // path on failure) — this catch is a last-resort guard so a future
            // change there can never crash the TUI.
            void revealOutputFolder(done.outDir).catch(() => { });
            return;
        }
        const transition = nextStepForMenuChoice(done, choice);
        if (!transition)
            return;
        if (transition.kind === 'discovering') {
            setStep({ kind: 'discovering' });
        }
        else {
            setStep({
                kind: 'confirming',
                slug: transition.slug,
                name: transition.name,
                courseCount: transition.courseCount,
                outDir: transition.outDir,
            });
        }
    }, [exit]);
    switch (step.kind) {
        case 'checking-session':
            return _jsx(Text, { children: "Checking your Skool session\u2026" });
        case 'login-needed':
            return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: "You are not signed in to Skool." }), _jsx(Text, { dimColor: true, children: "Nothing is typed for you \u2014 a browser window opens and you sign in yourself." }), _jsx(ConfirmPrompt, { onConfirm: () => setStep({ kind: 'logging-in' }) })] }));
        case 'logging-in':
            return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: "A browser window is open. Sign in there." }), _jsx(Text, { dimColor: true, children: "Waiting for you to finish (Ctrl+C to cancel)\u2026" })] }));
        case 'discovering':
            return _jsx(Text, { children: "Looking up the communities you belong to\u2026" });
        case 'picking': {
            const items = [
                ...step.communities.map((community) => ({
                    label: `${community.name}  (skool.com/${community.slug})`,
                    value: community,
                })),
                { label: 'Enter a slug manually…', value: null },
            ];
            return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: "Which community?" }), _jsx(SelectList, { items: items, onSelect: (value) => {
                            if (value === null)
                                setStep({ kind: 'manual-slug', value: '', error: null });
                            else
                                chooseCommunity(value.slug, value.name);
                        } })] }));
        }
        case 'manual-slug':
            return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: "Enter the community slug \u2014 the part after skool.com/" }), _jsxs(Text, { children: ["Slug: ", step.value, _jsx(Text, { color: "gray", children: "\u2588" })] }), step.error && _jsx(Text, { color: "red", children: step.error }), _jsx(ManualSlugInput, { value: step.value, onChange: (value) => setStep({ kind: 'manual-slug', value, error: null }), onSubmit: (value) => {
                            const slug = normalizeSlug(value);
                            if (!isValidSlug(slug)) {
                                setStep({ kind: 'manual-slug', value, error: `"${value}" doesn't look like a valid slug.` });
                                return;
                            }
                            chooseCommunity(slug, slug);
                        } })] }));
        case 'counting':
            return _jsxs(Text, { children: ["Looking up courses in ", step.name, "\u2026"] });
        case 'confirming':
            return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { children: ["Community: ", step.name, " (skool.com/", step.slug, ")"] }), _jsxs(Text, { children: ["Courses found: ", step.courseCount] }), _jsxs(Text, { children: ["Output will be written to: ", step.outDir] }), _jsx(Text, { children: " " }), _jsx(ConfirmPrompt, { onConfirm: () => setStep({
                            kind: 'syncing',
                            slug: step.slug,
                            name: step.name,
                            courseCount: step.courseCount,
                            outDir: step.outDir,
                            progress: createProgressState(0),
                        }) })] }));
        case 'syncing': {
            const { progress } = step;
            return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: formatProgressBar(progress.done, progress.total) }), progress.current && (_jsxs(Text, { dimColor: true, children: ["current: ", progress.current.course, " / ", progress.current.title] })), _jsxs(Text, { dimColor: true, children: ["ok ", progress.counts.ok, "  skipped ", progress.counts.skipped, "  no-video ", progress.counts['no-video'], ' ', "no-access ", progress.counts['no-access'], "  unavailable ", progress.counts.unavailable, "  failed", ' ', progress.counts.failed] })] }));
        }
        case 'done': {
            const lines = formatSummary(step.summary, step.outDir);
            const done = {
                slug: step.slug,
                name: step.name,
                courseCount: step.courseCount,
                outDir: step.outDir,
                summary: step.summary,
            };
            return (_jsxs(Box, { flexDirection: "column", children: [lines.map((line, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    _jsx(Text, { children: line || ' ' }, index))), _jsx(Text, { children: " " }), _jsx(Text, { children: "What next?" }), _jsx(SelectList, { items: MENU_ITEMS, onSelect: (choice) => handleMenuChoice(done, choice) })] }));
        }
        case 'error':
            return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: "red", children: ["Something went wrong: ", step.message] }), _jsx(ExitPrompt, { label: "Press any key to exit." })] }));
    }
}
