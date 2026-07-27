"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BackfillButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBackfill() {
    if (
      !window.confirm(
        "This pulls your full available transaction history (up to ~2 years) and can take a minute or two. Continue?",
      )
    ) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/plaid/backfill", { method: "POST" }),
        fetch("/api/flinks/backfill", { method: "POST" }),
      ]);

      const failed = responses.some((res) => !res.ok);
      if (failed) throw new Error("Backfill failed for one or more accounts");

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleBackfill}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {loading ? "Backfilling…" : "Backfill full history"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
