import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "PF Uprise",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Failed to create Plaid link token", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 },
    );
  }
}
