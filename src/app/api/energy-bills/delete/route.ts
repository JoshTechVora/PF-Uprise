import { NextResponse } from "next/server";
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

  const { billId } = await request.json();

  if (!billId) {
    return NextResponse.json({ error: "Missing billId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: bill, error: fetchError } = await admin
    .from("energy_bills")
    .select("id, file_path")
    .eq("id", billId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  await admin.storage.from("energy-bills").remove([bill.file_path]);

  await admin
    .from("document_chunks")
    .delete()
    .eq("source_type", "energy_bill")
    .eq("source_id", bill.id);

  const { error: deleteError } = await admin
    .from("energy_bills")
    .delete()
    .eq("id", bill.id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
