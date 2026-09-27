import { NextResponse } from "next/server";
import {
  isTransactionCategory,
  isTransactionSubcategory,
} from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId, category, subcategory } = await request.json();

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  if (category !== null && !isTransactionCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (
    subcategory != null &&
    (category === null || !isTransactionSubcategory(category, subcategory))
  ) {
    return NextResponse.json({ error: "Invalid subcategory" }, { status: 400 });
  }

  // RLS scopes this update to rows where user_id = auth.uid(), so a caller
  // can only ever touch their own transactions.
  const { error } = await supabase
    .from("transactions")
    .update({ transaction_type: category, subcategory: subcategory ?? null })
    .eq("id", transactionId);

  if (error) {
    const details = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
    console.error(
      `[update-category] Failed to set transaction ${transactionId} to "${category}${subcategory ? ` › ${subcategory}` : ""}"`,
      details,
    );
    return NextResponse.json(
      {
        error: "Failed to update category",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
