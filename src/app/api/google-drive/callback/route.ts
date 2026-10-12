import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  expiresAtFrom,
  getAccountEmail,
  googleRedirectUri,
  OAUTH_STATE_COOKIE,
} from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function backToEnergy(request: Request, status: "connected" | "error") {
  return NextResponse.redirect(
    new URL(`/dashboard/energy?google_drive=${status}`, request.url),
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: "/api/google-drive" });

  if (url.searchParams.get("error")) {
    console.error("[google-drive] Sign-in was cancelled or failed", url.searchParams.get("error"));
    return backToEnergy(request, "error");
  }

  if (!code || !state || state !== expectedState) {
    console.error("[google-drive] Missing code or state mismatch in callback");
    return backToEnergy(request, "error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, googleRedirectUri(request.url));
    if (!tokens.refresh_token) {
      throw new Error("Google didn't return a refresh token");
    }
    const accountEmail = await getAccountEmail(tokens.access_token);

    const { error } = await createAdminClient()
      .from("google_drive_connections")
      .upsert(
        {
          user_id: user.id,
          account_email: accountEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAtFrom(tokens),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  } catch (error) {
    console.error("[google-drive] Failed to complete connection", error);
    return backToEnergy(request, "error");
  }

  return backToEnergy(request, "connected");
}
