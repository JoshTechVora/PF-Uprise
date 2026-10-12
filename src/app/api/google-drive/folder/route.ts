import { NextResponse } from "next/server";
import { getAccessToken, GoogleDriveError, resolveFolder } from "@/lib/google-drive";
import { isTransactionCategory } from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

// Saves which Google Drive folder to sync for a category, after checking it
// exists. One folder per user per category (drive_folders).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, folder } = await request.json();
  if (typeof category !== "string" || !isTransactionCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof folder !== "string") {
    return NextResponse.json({ error: "Missing folder link" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(user.id);
    const resolved = await resolveFolder(accessToken, folder);

    // RLS scopes drive_folders to the caller's own rows.
    const { error } = await supabase.from("drive_folders").upsert(
      {
        user_id: user.id,
        category,
        folder_id: resolved.id,
        folder_name: resolved.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" },
    );
    if (error) throw error;

    return NextResponse.json({ folderName: resolved.name });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[google-drive] Failed to save ${category} folder`, error);
    return NextResponse.json({ error: "Failed to save folder" }, { status: 500 });
  }
}
