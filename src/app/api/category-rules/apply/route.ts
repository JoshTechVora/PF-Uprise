import { NextResponse } from "next/server";
import { categorizeWithAi } from "@/lib/ai-categorize";
import { createClient } from "@/lib/supabase/server";

// The AI step can take a while on a large backlog.
export const maxDuration = 300;

// Matches the dashboard's default "last 30 days" transaction list.
const LOOKBACK_DAYS = 30;

const LOG_PREFIX = "[auto-categorize]";

// Supabase errors carry the useful detail (e.g. which check constraint
// failed) in code/details/hint, which a bare console.error doesn't surface.
function describeError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  return { message: error.message, code: error.code, details: error.details, hint: error.hint };
}

// Only include raw error details in the response outside production.
function errorResponse(message: string, error: Parameters<typeof describeError>[0]) {
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV !== "production" && { details: describeError(error) }),
    },
    { status: 500 },
  );
}

export async function POST() {
  try {
    return await autoCategorize();
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error`, error);
    return errorResponse("Unexpected error while auto-categorizing", error as Error);
  }
}

async function autoCategorize() {
  const startedAt = Date.now();
  const elapsed = () => `${Date.now() - startedAt}ms`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rules, error: rulesError } = await supabase
    .from("category_rules")
    .select("match_text, category, subcategory")
    .order("created_at", { ascending: true });

  if (rulesError) {
    console.error(`${LOG_PREFIX} Failed to load rules`, describeError(rulesError));
    return errorResponse("Failed to load rules", rulesError);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, name, merchant_name, amount, category")
    .is("transaction_type", null)
    .is("deleted_at", null)
    .gte("date", cutoff.toISOString().slice(0, 10));

  if (transactionsError) {
    console.error(`${LOG_PREFIX} Failed to load transactions`, describeError(transactionsError));
    return errorResponse("Failed to load transactions", transactionsError);
  }

  console.log(
    `${LOG_PREFIX} Loaded ${rules?.length ?? 0} rules and ${transactions?.length ?? 0} uncategorized transactions since ${cutoff.toISOString().slice(0, 10)} (${elapsed()})`,
  );

  // Rules run first (first matching rule wins); whatever they don't match
  // goes to the AI. Only uncategorized transactions are touched, so this
  // never clobbers a manual choice.
  const assignments = new Map<string, { category: string; subcategory: string | null; ids: string[] }>();
  function assign(id: string, category: string, subcategory: string | null) {
    const key = `${category}|${subcategory ?? ""}`;
    const group = assignments.get(key) ?? { category, subcategory, ids: [] };
    group.ids.push(id);
    assignments.set(key, group);
  }

  const unmatched: NonNullable<typeof transactions> = [];
  for (const transaction of transactions ?? []) {
    const haystack = `${transaction.name ?? ""} ${transaction.merchant_name ?? ""}`.toLowerCase();
    const rule = (rules ?? []).find((r) => haystack.includes(r.match_text.toLowerCase()));
    if (rule) {
      assign(transaction.id, rule.category, rule.subcategory);
    } else {
      unmatched.push(transaction);
    }
  }
  const byRules = (transactions ?? []).length - unmatched.length;
  console.log(`${LOG_PREFIX} Rules matched ${byRules}; sending ${unmatched.length} to AI`);

  let byAi = 0;
  let aiError: string | null = null;
  if (unmatched.length > 0) {
    try {
      const suggestions = await categorizeWithAi(unmatched);
      for (const suggestion of suggestions) {
        assign(suggestion.id, suggestion.category, suggestion.subcategory);
      }
      byAi = suggestions.length;
      console.log(`${LOG_PREFIX} AI categorized ${byAi} of ${unmatched.length} (${elapsed()})`);
    } catch (error) {
      console.error(`${LOG_PREFIX} AI categorization failed (${elapsed()})`, error);
      aiError = "AI categorization failed; only rules were applied.";
    }
  }

  for (const { category, subcategory, ids } of assignments.values()) {
    const { error } = await supabase
      .from("transactions")
      .update({ transaction_type: category, subcategory })
      .in("id", ids)
      .is("transaction_type", null);
    if (error) {
      console.error(
        `${LOG_PREFIX} Failed to save ${ids.length} transactions as "${category}${subcategory ? ` › ${subcategory}` : ""}"`,
        describeError(error),
        { sampleIds: ids.slice(0, 5) },
      );
      return errorResponse("Failed to apply categories", error);
    }
  }

  console.log(
    `${LOG_PREFIX} Done: ${byRules} by rules, ${byAi} by AI, ${unmatched.length - byAi} skipped (${elapsed()})`,
  );

  return NextResponse.json({
    success: true,
    updated: byRules + byAi,
    byRules,
    byAi,
    skipped: unmatched.length - byAi,
    aiError,
  });
}
