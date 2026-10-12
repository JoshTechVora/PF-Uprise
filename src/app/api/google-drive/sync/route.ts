import { NextResponse } from "next/server";
import { importEnergyBill } from "@/lib/energy-bill-import";
import {
  downloadFile,
  getAccessToken,
  GoogleDriveError,
  listFolderPdfs,
} from "@/lib/google-drive";
import { isTransactionCategory } from "@/lib/transaction-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Downloading and indexing several PDFs can take a while.
export const maxDuration = 300;

const LOG_PREFIX = "[google-drive-sync]";

// Categories whose synced files have somewhere to go. Energy bills land in
// energy_bills; other categories can save a folder but can't sync yet.
const SYNCABLE_CATEGORIES = new Set(["Energy"]);

// Imports any PDFs in a category's Google Drive folder that haven't been
// imported yet. Files the user removed from the app (ignored_file_ids) are
// skipped unless the request sets includeRemoved, which un-ignores them.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, includeRemoved = false } = await request.json().catch(() => ({}));
  if (typeof category !== "string" || !isTransactionCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!SYNCABLE_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: `Syncing isn't available for ${category} yet` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("ignored_file_ids")
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Google Drive isn't connected" }, { status: 400 });
  }

  const { data: folder } = await supabase
    .from("drive_folders")
    .select("id, folder_id, folder_name")
    .eq("category", category)
    .maybeSingle();

  if (!folder) {
    return NextResponse.json(
      { error: `Choose a Google Drive folder for ${category} first` },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAccessToken(user.id);
    const files = await listFolderPdfs(accessToken, folder.folder_id);

    const { data: existing } = await admin
      .from("energy_bills")
      .select("id, file_path, drive_file_id, status")
      .eq("user_id", user.id)
      .not("drive_file_id", "is", null);

    // Bills that failed to index last time (e.g. the embeddings service was
    // down) are cleared out and imported again rather than skipped forever.
    const failedBefore = (existing ?? []).filter((bill) => bill.status === "failed");
    if (failedBefore.length > 0) {
      await admin.storage.from("energy-bills").remove(failedBefore.map((bill) => bill.file_path));
      await admin
        .from("document_chunks")
        .delete()
        .eq("source_type", "energy_bill")
        .in("source_id", failedBefore.map((bill) => bill.id));
      await admin
        .from("energy_bills")
        .delete()
        .in("id", failedBefore.map((bill) => bill.id));
    }

    let ignored = new Set<string>((connection.ignored_file_ids as string[] | null) ?? []);
    const removedInFolder = files.filter((file) => ignored.has(file.id));

    if (includeRemoved && removedInFolder.length > 0) {
      ignored = new Set([...ignored].filter((id) => !removedInFolder.some((f) => f.id === id)));
      await admin
        .from("google_drive_connections")
        .update({ ignored_file_ids: [...ignored] })
        .eq("user_id", user.id);
    }

    const importedIds = new Set(
      (existing ?? [])
        .filter((bill) => bill.status !== "failed")
        .map((bill) => bill.drive_file_id as string),
    );
    const newFiles = files.filter((file) => !importedIds.has(file.id) && !ignored.has(file.id));

    console.log(
      `${LOG_PREFIX} ${files.length} PDFs in ${category} folder "${folder.folder_name}", ${newFiles.length} to import (${failedBefore.length} retrying after a failure, ${includeRemoved ? `${removedInFolder.length} previously removed restored` : `${removedInFolder.length} previously removed skipped`})`,
    );

    let imported = 0;
    const failed: string[] = [];
    // One at a time: each import extracts text and calls the embeddings API.
    for (const file of newFiles) {
      try {
        const buffer = await downloadFile(accessToken, file.id);
        const bill = await importEnergyBill({
          userId: user.id,
          buffer,
          fileName: file.name,
          contentType: "application/pdf",
          source: "google_drive",
          driveFileId: file.id,
        });
        // Indexing failures don't throw; they're recorded on the bill.
        if (bill.status === "failed") {
          failed.push(`${file.name} (${bill.error_message ?? "indexing failed"})`);
        } else {
          imported += 1;
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Failed to import "${file.name}"`, error);
        failed.push(file.name);
      }
    }

    await supabase
      .from("drive_folders")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", folder.id);

    return NextResponse.json({
      success: true,
      found: files.length,
      imported,
      alreadyImported: importedIds.size,
      // Files in the folder that were skipped because the user removed them.
      removedSkipped: includeRemoved ? 0 : removedInFolder.length,
      failed,
    });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`${LOG_PREFIX} Sync failed`, error);
    return NextResponse.json({ error: "Google Drive sync failed" }, { status: 500 });
  }
}
