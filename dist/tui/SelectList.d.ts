import React from 'react';
export interface SelectItem<T> {
    label: string;
    value: T;
}
interface SelectListProps<T> {
    items: Array<SelectItem<T>>;
    onSelect: (value: T) => void;
}
/** Minimal arrow-key list, built directly on Ink's useInput rather than pulling
 *  in a select-input dependency. Cheap to render: a handful of Text lines,
 *  re-rendered only on cursor movement or selection. */
export declare function SelectList<T>({ items, onSelect }: SelectListProps<T>): React.JSX.Element;
export {};
