"use client";

import { useState, type ReactNode } from "react";

export function DashboardShell({
  main,
  chat,
}: {
  main: ReactNode;
  chat: ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <main
        className={`min-w-0 flex-1 ${chatOpen ? "max-w-3xl" : "max-w-6xl"}`}
      >
        {main}
      </main>

      {chatOpen ? (
        <aside className="min-w-96 flex-1">
          <div className="sticky top-10">
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="mb-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Hide chat →
            </button>
            {chat}
          </div>
        </aside>
      ) : (
        <div className="shrink-0">
          <div className="sticky top-10">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              title="Show chat"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              ← Chat
            </button>
          </div>
        </div>
      )}
    </>
  );
}
