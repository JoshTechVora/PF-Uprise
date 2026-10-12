import { randomUUID } from "node:crypto";
import { indexEnergyBill } from "@/lib/energy-bill-indexing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stores a bill file in the energy-bills bucket, records it in energy_bills,
 * and indexes it for search. Shared by manual uploads and the Google Drive sync.
 */
export async function importEnergyBill(params: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  contentType: string | null;
  source: "upload" | "google_drive";
  driveFileId?: string;
}) {
  const { userId, buffer, fileName, contentType, source, driveFileId } = params;
  const admin = createAdminClient();
  const storagePath = `${userId}/${randomUUID()}-${fileName}`;

  const { error: uploadError } = await admin.storage
    .from("energy-bills")
    .upload(storagePath, buffer, {
      contentType: contentType || "application/octet-stream",
    });

  if (uploadError) {
    console.error("Failed to upload energy bill", uploadError);
    throw new Error("Upload failed");
  }

  const { data: energyBill, error: insertError } = await admin
    .from("energy_bills")
    .insert({
      user_id: userId,
      file_path: storagePath,
      file_name: fileName,
      content_type: contentType || null,
      size_bytes: buffer.length,
      status: "processing",
      source,
      drive_file_id: driveFileId ?? null,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Failed to save energy bill", insertError);
    await admin.storage.from("energy-bills").remove([storagePath]);
    throw new Error("Failed to save bill");
  }

  await indexEnergyBill({
    userId,
    energyBillId: energyBill.id,
    fileBuffer: buffer,
    contentType: contentType || null,
    fileName,
  });

  const { data: updatedBill } = await admin
    .from("energy_bills")
    .select("*")
    .eq("id", energyBill.id)
    .single();

  return updatedBill ?? energyBill;
}
