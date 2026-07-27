"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRANSACTION_CATEGORIES } from "@/lib/transaction-categories";

export function TransactionCategorySelect({
  transactionId,
  category,
}: {
  transactionId: string;
  category: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(category ?? "");
  const [saving, setSaving] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setValue(next);
    setSaving(true);
    try {
      await fetch("/api/transactions/update-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, category: next || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <option value="">Uncategorized</option>
      {TRANSACTION_CATEGORIES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
