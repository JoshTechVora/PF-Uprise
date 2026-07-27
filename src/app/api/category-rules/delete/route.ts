import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ruleId } = await request.json();

  if (!ruleId) {
    return NextResponse.json({ error: "Missing ruleId" }, { status: 400 });
  }

  // RLS scopes this delete to rows where user_id = auth.uid().
  const { error } = await supabase
    .from("category_rules")
    .delete()
    .eq("id", ruleId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
