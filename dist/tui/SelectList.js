import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Box, Text, useInput } from 'ink';
/** Minimal arrow-key list, built directly on Ink's useInput rather than pulling
 *  in a select-input dependency. Cheap to render: a handful of Text lines,
 *  re-rendered only on cursor movement or selection. */
export function SelectList({ items, onSelect }) {
    const [cursor, setCursor] = React.useState(0);
    useInput((input, key) => {
        if (items.length === 0)
            return;
        if (key.upArrow || input === 'k') {
            setCursor((current) => (current - 1 + items.length) % items.length);
        }
        else if (key.downArrow || input === 'j') {
            setCursor((current) => (current + 1) % items.length);
        }
        else if (key.return) {
            const item = items[cursor];
            if (item)
                onSelect(item.value);
        }
    });
    return (_jsx(Box, { flexDirection: "column", children: items.map((item, index) => (_jsxs(Text, { color: index === cursor ? 'cyan' : undefined, children: [index === cursor ? '> ' : '  ', item.label] }, item.label))) }));
}
