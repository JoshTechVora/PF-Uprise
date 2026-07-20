import { NextResponse } from "next/server";
import { syncFlinksItem } from "@/lib/flinks-sync";
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

  const { loginId, institutionName } = await request.json();

  if (!loginId) {
    return NextResponse.json({ error: "Missing loginId" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: flinksItem, error } = await admin
      .from("flinks_items")
      .upsert(
        {
          user_id: user.id,
          login_id: loginId,
          institution_name: institutionName ?? null,
        },
        { onConflict: "login_id" },
      )
      .select("id")
      .single();

    if (error) throw error;

    await syncFlinksItem({
      userId: user.id,
      flinksItemId: flinksItem.id,
      loginId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to exchange Flinks loginId", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 },
    );
  }
}
