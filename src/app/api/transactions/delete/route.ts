import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId } = await request.json();

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  // Soft delete: bank syncs upsert by transaction_id, so a hard-deleted row
  // would come straight back on the next sync. Syncs never write deleted_at,
  // so this sticks. RLS scopes the update to the caller's own transactions.
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", transactionId);

  if (error) {
    console.error(`[delete-transaction] Failed to delete transaction ${transactionId}`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
