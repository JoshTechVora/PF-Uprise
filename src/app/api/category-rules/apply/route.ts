import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rules, error: rulesError } = await supabase
    .from("category_rules")
    .select("match_text, category")
    .order("created_at", { ascending: true });

  if (rulesError) {
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, name, merchant_name")
    .is("transaction_type", null);

  if (transactionsError) {
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 },
    );
  }

  // First matching rule wins; only fill in transactions that aren't
  // already categorized, so this never clobbers a manual choice.
  const idsByCategory = new Map<string, string[]>();
  for (const transaction of transactions ?? []) {
    const haystack = `${transaction.name ?? ""} ${transaction.merchant_name ?? ""}`.toLowerCase();
    const rule = rules.find((r) => haystack.includes(r.match_text.toLowerCase()));
    if (!rule) continue;

    const ids = idsByCategory.get(rule.category) ?? [];
    ids.push(transaction.id);
    idsByCategory.set(rule.category, ids);
  }

  let updated = 0;
  for (const [category, ids] of idsByCategory) {
    const { error } = await supabase
      .from("transactions")
      .update({ transaction_type: category })
      .in("id", ids);
    if (error) {
      return NextResponse.json({ error: "Failed to apply rules" }, { status: 500 });
    }
    updated += ids.length;
  }

  return NextResponse.json({ success: true, updated });
}
