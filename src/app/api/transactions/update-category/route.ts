import { NextResponse } from "next/server";
import { isTransactionCategory } from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId, category } = await request.json();

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  if (category !== null && !isTransactionCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // RLS scopes this update to rows where user_id = auth.uid(), so a caller
  // can only ever touch their own transactions.
  const { error } = await supabase
    .from("transactions")
    .update({ transaction_type: category })
    .eq("id", transactionId);

  if (error) {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
