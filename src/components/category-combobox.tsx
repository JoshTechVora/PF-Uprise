"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  encodeCategoryValue,
  TRANSACTION_CATEGORIES,
  TRANSACTION_SUBCATEGORIES,
} from "@/lib/transaction-categories";

type Option = { value: string; label: string };

// Every category, each followed by its subcategories.
const CATEGORY_OPTIONS: Option[] = TRANSACTION_CATEGORIES.flatMap((category) => [
  { value: encodeCategoryValue(category, null), label: category },
  ...TRANSACTION_SUBCATEGORIES[category].map((subcategory) => ({
    value: encodeCategoryValue(category, subcategory),
    label: `${category} › ${subcategory}`,
  })),
]);

const UNCATEGORIZED: Option = { value: "", label: "Uncategorized" };

// Every word typed must appear somewhere in the label, so "groc" and
// "food sn" both work.
function matches(label: string, query: string) {
  const haystack = label.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function CategoryCombobox({
  value,
  onChange,
  allowUncategorized = false,
  disabled = false,
  className = "",
}: {
  // Encoded category value (see encodeCategoryValue); "" for uncategorized.
  value: string;
  onChange: (value: string) => void;
  allowUncategorized?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const options = useMemo(
    () => (allowUncategorized ? [UNCATEGORIZED, ...CATEGORY_OPTIONS] : CATEGORY_OPTIONS),
    [allowUncategorized],
  );
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";
  const filtered = options.filter((option) => matches(option.label, query));

  function openList() {
    setQuery("");
    setHighlighted(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(option: Option) {
    close();
    if (option.value !== value) onChange(option.value);
  }

  function moveHighlight(next: number) {
    setHighlighted(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(Math.min(highlighted + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(Math.max(highlighted - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[highlighted]) choose(filtered[highlighted]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlighted] ? `${listId}-${highlighted}` : undefined}
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={open ? selectedLabel || "Type to search…" : undefined}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`rounded-md border border-zinc-300 bg-white text-zinc-700 placeholder:text-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder:text-zinc-500 ${className}`}
      />
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute right-0 z-20 mt-1 max-h-64 min-w-full w-56 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400">No matches</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value || "uncategorized"}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                // mousedown (not click) so the input's blur doesn't close
                // the list before the choice registers.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={`cursor-pointer px-3 py-1.5 ${
                  index === highlighted
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300"
                } ${option.value === value ? "font-medium" : ""} ${
                  option.label.includes("›") ? "pl-6" : ""
                }`}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
