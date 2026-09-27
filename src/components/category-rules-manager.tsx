"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  decodeCategoryValue,
  TRANSACTION_CATEGORIES,
} from "@/lib/transaction-categories";

type CategoryRule = {
  id: string;
  match_text: string;
  category: string;
  subcategory: string | null;
};

export function CategoryRulesManager({ rules }: { rules: CategoryRule[] }) {
  const router = useRouter();
  const [matchText, setMatchText] = useState("");
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleAddRule(event: React.FormEvent) {
    event.preventDefault();
    if (!matchText.trim()) return;

    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchText, ...decodeCategoryValue(category) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add rule");
      }
      setMatchText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    setError(null);
    try {
      await fetch("/api/category-rules/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      router.refresh();
    } catch {
      setError("Failed to delete rule");
    }
  }

  async function handleApply() {
    setError(null);
    setResult(null);
    setApplying(true);
    try {
      const res = await fetch("/api/category-rules/apply", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to auto-categorize");
      const plural = (n: number) => `${n} transaction${n === 1 ? "" : "s"}`;
      setResult(
        data.updated === 0 && data.skipped === 0
          ? "No uncategorized transactions in the last 30 days."
          : [
              `Categorized ${plural(data.updated)} (${data.byRules} by rules, ${data.byAi} by AI).`,
              data.skipped > 0 ? `${plural(data.skipped)} left for you to review.` : "",
            ]
              .filter(Boolean)
              .join(" "),
      );
      if (data.aiError) setError(data.aiError);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to auto-categorize");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Auto-categorize applies your rules, then uses AI for the rest of the
          last 30 days&apos; uncategorized transactions. It never overwrites a
          category you set manually.
        </p>
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {applying ? "Running…" : "Auto-categorize"}
        </button>
      </div>

      <form onSubmit={handleAddRule} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={matchText}
          onChange={(e) => setMatchText(e.target.value)}
          placeholder="Text to match, e.g. Kroger"
          className="min-w-[160px] flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <CategoryCombobox
          value={category}
          onChange={setCategory}
          className="w-56 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={saving || !matchText.trim()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add rule
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-500">{result}</p>
      )}

      {rules.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between py-2">
              <span className="text-zinc-700 dark:text-zinc-300">
                &ldquo;{rule.match_text}&rdquo; &rarr; {rule.category}
                {rule.subcategory && ` › ${rule.subcategory}`}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(rule.id)}
                className="text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
