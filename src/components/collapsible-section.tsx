"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  actions,
  defaultOpen = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-lg font-medium text-zinc-900 dark:text-zinc-50"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            <path d="M7.05 4.05a1 1 0 0 1 1.414 0l4.243 4.243a1 1 0 0 1 0 1.414L8.464 13.95a1 1 0 1 1-1.414-1.414L10.586 9 7.05 5.464a1 1 0 0 1 0-1.414Z" />
          </svg>
          {title}
        </button>
        <div className="flex items-center gap-3">{actions}</div>
      </div>

      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
