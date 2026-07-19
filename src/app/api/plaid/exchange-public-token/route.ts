import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { syncPlaidItem } from "@/lib/plaid-sync";
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

  const { public_token: publicToken, institution_name: institutionName } =
    await request.json();

  if (!publicToken) {
    return NextResponse.json(
      { error: "Missing public_token" },
      { status: 400 },
    );
  }

  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const { access_token: accessToken, item_id: itemId } =
      exchangeResponse.data;

    const admin = createAdminClient();
    const { data: plaidItem, error } = await admin
      .from("plaid_items")
      .insert({
        user_id: user.id,
        item_id: itemId,
        access_token: accessToken,
        institution_name: institutionName ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    await syncPlaidItem({
      userId: user.id,
      plaidItemId: plaidItem.id,
      accessToken,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to exchange Plaid public token", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 },
    );
  }
}
