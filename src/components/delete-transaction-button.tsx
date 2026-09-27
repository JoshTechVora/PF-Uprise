"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTransactionButton({
  transactionId,
  description,
}: {
  transactionId: string;
  // Shown in the confirmation, e.g. "Costco · $84.12 on 2026-09-20".
  description: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete transaction");
      }
      dialogRef.current?.close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Delete transaction"
        title="Delete transaction"
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-red-500"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        // Clicking the backdrop (the dialog element itself) cancels.
        onClick={(e) => {
          if (e.target === dialogRef.current && !deleting) dialogRef.current.close();
        }}
        className="m-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-0 text-left shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Delete this transaction?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            It will be removed from your dashboard and totals, and won&apos;t come
            back when your bank syncs.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={deleting}
              autoFocus
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
