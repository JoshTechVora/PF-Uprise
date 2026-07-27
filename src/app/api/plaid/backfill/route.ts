import { NextResponse } from "next/server";
import { syncPlaidItem } from "@/lib/plaid-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: items, error } = await admin
    .from("plaid_items")
    .select("id, access_token")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
  }

  try {
    const results = await Promise.all(
      (items ?? []).map((item) =>
        syncPlaidItem(
          {
            userId: user.id,
            plaidItemId: item.id,
            accessToken: item.access_token,
          },
          { historical: true },
        ),
      ),
    );

    const transactionCount = results.reduce(
      (sum, result) => sum + result.transactionCount,
      0,
    );

    return NextResponse.json({ success: true, transactionCount });
  } catch (error) {
    console.error("Failed to backfill Plaid items", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
