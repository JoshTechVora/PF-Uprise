"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { TransactionCategory } from "@/lib/transaction-categories";

export type GoogleDriveConnection = {
  account_email: string | null;
};

export type DriveFolder = {
  folder_name: string;
  last_synced_at: string | null;
};

// Connect Google Drive (once per user), then pick and sync the folder for
// one category (stored per category in drive_folders).
export function GoogleDriveFolderSync({
  category,
  connection,
  folder,
  status,
}: {
  category: TransactionCategory;
  connection: GoogleDriveConnection | null;
  folder: DriveFolder | null;
  // From ?google_drive= after the Google sign-in redirect.
  status?: string;
}) {
  const router = useRouter();
  const [folderLink, setFolderLink] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Files in the folder that sync skipped because they were removed in the app.
  const [removedSkipped, setRemovedSkipped] = useState(0);
  const [error, setError] = useState<string | null>(
    status === "error"
      ? "Couldn't connect to Google Drive. Please try again."
      : status === "not-configured"
        ? "Google Drive isn't set up yet: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing from the server's environment."
        : null,
  );
  const [result, setResult] = useState<string | null>(
    status === "connected"
      ? `Google Drive connected. Now paste the link to your ${category} folder.`
      : null,
  );

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
    return data;
  }

  async function handleSaveFolder(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setSavingFolder(true);
    try {
      const data = await post("/api/google-drive/folder", { category, folder: folderLink });
      setFolderLink("");
      setResult(`Folder saved. Click "Sync now" to import bills from "${data.folderName}".`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setSavingFolder(false);
    }
  }

  async function handleSync(includeRemoved = false) {
    setError(null);
    setResult(null);
    setSyncing(true);
    try {
      const data = await post("/api/google-drive/sync", { category, includeRemoved });
      setRemovedSkipped(data.removedSkipped ?? 0);
      const parts = [
        data.imported === 0
          ? "No new files found."
          : `Imported ${data.imported} new file${data.imported === 1 ? "" : "s"}.`,
      ];
      if (data.failed.length > 0) {
        parts.push(`Failed: ${data.failed.join(", ")}.`);
      }
      setResult(parts.join(" "));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setResult(null);
    try {
      await post("/api/google-drive/disconnect");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {!connection ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect Google Drive to import {category.toLowerCase()} documents
            straight from the folder you keep them in.
          </p>
          {/* A plain link: this route redirects to Google's sign-in page. */}
          <a
            href="/api/google-drive/connect"
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Connect Google Drive
          </a>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Google Drive connected
              {connection.account_email ? ` as ${connection.account_email}` : ""}
              {folder ? (
                <>
                  {" · syncing from "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {folder.folder_name}
                  </span>
                </>
              ) : null}
              {folder?.last_synced_at
                ? ` · last synced ${new Date(folder.last_synced_at).toLocaleString()}`
                : ""}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleSync()}
                disabled={syncing || !folder}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400"
              >
                Disconnect
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveFolder} className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="google-drive-folder" className="text-sm text-zinc-600 dark:text-zinc-400">
              {folder ? `Change ${category} folder` : `${category} folder`}
            </label>
            <input
              id="google-drive-folder"
              type="text"
              value={folderLink}
              onChange={(e) => setFolderLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className="min-w-[200px] flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={savingFolder || !folderLink.trim()}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {savingFolder ? "Checking…" : "Save folder"}
            </button>
          </form>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Open the folder in Google Drive and copy the link from the address
            bar. PDFs directly in that folder are imported; subfolders are
            ignored.
          </p>
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-500">{result}</p>
      )}
      {removedSkipped > 0 && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Skipped {removedSkipped} file{removedSkipped === 1 ? "" : "s"} you removed earlier.{" "}
          <button
            type="button"
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="font-medium text-zinc-900 underline hover:no-underline disabled:opacity-50 dark:text-zinc-50"
          >
            Re-import {removedSkipped === 1 ? "it" : "them"}
          </button>
        </p>
      )}
    </div>
  );
}
