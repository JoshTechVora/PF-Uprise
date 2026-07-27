import { NextResponse } from "next/server";
import { isTransactionCategory } from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("category_rules")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }

  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchText, category } = await request.json();

  if (!matchText || typeof matchText !== "string" || !matchText.trim()) {
    return NextResponse.json({ error: "Missing matchText" }, { status: 400 });
  }

  if (!isTransactionCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("category_rules")
    .insert({ user_id: user.id, match_text: matchText.trim(), category })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A rule for that text already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}
