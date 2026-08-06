export const MENU_ITEMS = [
    { label: 'Sync another community', value: 'sync-another' },
    { label: 'Sync this community again', value: 'sync-again' },
    { label: 'Open output folder', value: 'open-folder' },
    { label: 'Quit', value: 'quit' },
];
/**
 * Given the state of the sync that just completed and the menu choice the
 * user made, returns the next step transition — or `null` when the choice
 * doesn't move to a new screen at all: `'open-folder'` is a side effect
 * performed in place (the menu stays up), and `'quit'` exits instead of
 * transitioning to another step.
 */
export function nextStepForMenuChoice(done, choice) {
    switch (choice) {
        case 'sync-another':
            return { kind: 'discovering' };
        case 'sync-again':
            return {
                kind: 'confirming',
                slug: done.slug,
                name: done.name,
                courseCount: done.courseCount,
                outDir: done.outDir,
            };
        case 'open-folder':
        case 'quit':
            return null;
    }
}
