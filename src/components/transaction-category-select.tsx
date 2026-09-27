"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  decodeCategoryValue,
  encodeCategoryValue,
} from "@/lib/transaction-categories";

export function TransactionCategorySelect({
  transactionId,
  category,
  subcategory,
}: {
  transactionId: string;
  category: string | null;
  subcategory: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(encodeCategoryValue(category, subcategory));
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch("/api/transactions/update-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, ...decodeCategoryValue(next) }),
      });
      if (!res.ok) {
        // Don't leave the dropdown showing a choice that wasn't saved.
        setValue(previous);
        const data = await res.json().catch(() => null);
        console.error("Failed to update category", data);
        alert(data?.error ?? "Failed to update category");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CategoryCombobox
      value={value}
      onChange={handleChange}
      allowUncategorized
      disabled={saving}
      className="w-48 px-2 py-1 text-xs"
    />
  );
}
