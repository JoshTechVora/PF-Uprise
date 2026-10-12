import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  googleRedirectUri,
  isGoogleDriveConfigured,
  OAUTH_STATE_COOKIE,
} from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";

// Starts the Google sign-in flow. The state cookie is checked in the
// callback to make sure the response belongs to this browser's request.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Without these, Google rejects the request with a confusing error, so
  // fail early with a clear one.
  if (!isGoogleDriveConfigured()) {
    console.error("[google-drive] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set; see README");
    return NextResponse.redirect(
      new URL("/dashboard/energy?google_drive=not-configured", request.url),
    );
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/api/google-drive",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state, googleRedirectUri(request.url)));
}
