import { NextResponse } from "next/server";
import { syncFlinksItem } from "@/lib/flinks-sync";
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
    .from("flinks_items")
    .select("id, login_id")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
  }

  try {
    const results = await Promise.all(
      (items ?? []).map((item) =>
        syncFlinksItem(
          {
            userId: user.id,
            flinksItemId: item.id,
            loginId: item.login_id,
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
    console.error("Failed to backfill Flinks items", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
