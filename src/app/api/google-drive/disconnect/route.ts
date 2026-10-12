import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Forgets the Google Drive tokens and folder. Bills already imported are kept.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  // Revoke the grant on Google's side too, so the app no longer appears in
  // the user's Google account permissions. Best effort.
  if (connection?.refresh_token) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: connection.refresh_token }),
    }).catch((error) => console.error("[google-drive] Failed to revoke token", error));
  }

  const { error } = await admin
    .from("google_drive_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[google-drive] Failed to disconnect", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
