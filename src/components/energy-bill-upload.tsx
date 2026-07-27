"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EnergyBill = {
  id: string;
  file_name: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

function statusBadgeClass(status: string) {
  if (status === "indexed") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  }
  if (status === "failed") {
    return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  }
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";
}

export function EnergyBillUpload({ bills }: { bills: EnergyBill[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/energy-bills/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Upload failed");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(billId: string) {
    try {
      await fetch("/api/energy-bills/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId }),
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(billId);
        return next;
      });
      router.refresh();
    } catch {
      setError("Failed to delete bill");
    }
  }

  function toggleSelected(billId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) {
        next.delete(billId);
      } else {
        next.add(billId);
      }
      return next;
    });
  }

  async function handleExtractInsights() {
    setError(null);
    setInsights(null);
    setExtracting(true);
    try {
      const res = await fetch("/api/energy-bills/extract-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to extract insights");
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract insights");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upload monthly energy/usage bills (PDF) to index them for search
          and chat.
        </p>
        <label className="shrink-0 cursor-pointer rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {uploading ? "Uploading…" : "Upload bill"}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {bills.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {bills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(bill.id)}
                    onChange={() => toggleSelected(bill.id)}
                    disabled={bill.status !== "indexed"}
                    aria-label={`Select ${bill.file_name}`}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-zinc-700 dark:text-zinc-300">
                      {bill.file_name}
                    </p>
                    {bill.status === "failed" && bill.error_message && (
                      <p className="text-xs text-red-600">{bill.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(bill.status)}`}
                  >
                    {bill.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(bill.id)}
                    className="text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleExtractInsights}
              disabled={selectedIds.size === 0 || extracting}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {extracting ? "Extracting…" : "Extract insights"}
            </button>
          </div>
        </>
      )}

      {insights && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {insights}
        </div>
      )}
    </div>
  );
}
