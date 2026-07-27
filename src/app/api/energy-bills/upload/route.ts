import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { indexEnergyBill } from "@/lib/energy-bill-indexing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const admin = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${user.id}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("energy-bills")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    console.error("Failed to upload energy bill", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: energyBill, error: insertError } = await admin
    .from("energy_bills")
    .insert({
      user_id: user.id,
      file_path: storagePath,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
      status: "processing",
    })
    .select("*")
    .single();

  if (insertError) {
    await admin.storage.from("energy-bills").remove([storagePath]);
    return NextResponse.json({ error: "Failed to save bill" }, { status: 500 });
  }

  await indexEnergyBill({
    userId: user.id,
    energyBillId: energyBill.id,
    fileBuffer: buffer,
    contentType: file.type || null,
  });

  const { data: updatedBill } = await admin
    .from("energy_bills")
    .select("*")
    .eq("id", energyBill.id)
    .single();

  return NextResponse.json({ bill: updatedBill ?? energyBill });
}
