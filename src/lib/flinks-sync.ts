import { authorizeLogin, getAccountsDetail, type FlinksAccount } from "@/lib/flinks";
import { createAdminClient } from "@/lib/supabase/admin";

function mapFlinksCategoryToType(category: string | null): string {
  if (!category) return "other";
  const normalized = category.toLowerCase();
  if (
    normalized.includes("investment") ||
    normalized.includes("rrsp") ||
    normalized.includes("tfsa")
  ) {
    return "investment";
  }
  if (normalized.includes("credit")) return "credit";
  if (normalized.includes("loan")) return "loan";
  return "depository";
}

/**
 * Pulls current accounts and transactions for a single Flinks login (e.g.
 * Wealthsimple) and upserts them into Supabase, scoped to the owning user.
 * Mirrors syncPlaidItem in plaid-sync.ts. By default only looks at the
 * last 90 days; pass `historical: true` for Flinks' full 365-day window
 * (used by the "Backfill full history" button).
 */
export async function syncFlinksItem(
  params: {
    userId: string;
    flinksItemId: string;
    loginId: string;
  },
  options?: { historical?: boolean },
) {
  const { userId, flinksItemId, loginId } = params;
  const admin = createAdminClient();

  const { RequestId } = await authorizeLogin(loginId);
  const detail = await getAccountsDetail(
    RequestId,
    options?.historical ? "Days365" : "Days90",
  );
  const flinksAccounts: FlinksAccount[] = detail.Accounts ?? [];

  const accountRows = flinksAccounts.map((account) => ({
    user_id: userId,
    flinks_item_id: flinksItemId,
    account_id: account.Id,
    name: account.Title,
    official_name: null,
    mask: null,
    type: mapFlinksCategoryToType(account.Category),
    subtype: account.Category,
    current_balance: account.Balance.Current,
    available_balance: account.Balance.Available,
    iso_currency_code: account.Currency ?? "CAD",
  }));

  if (accountRows.length > 0) {
    const { error } = await admin
      .from("accounts")
      .upsert(accountRows, { onConflict: "account_id" });
    if (error) throw error;
  }

  const { data: storedAccounts, error: accountsFetchError } = await admin
    .from("accounts")
    .select("id, account_id")
    .eq("flinks_item_id", flinksItemId);
  if (accountsFetchError) throw accountsFetchError;

  const accountIdMap = new Map(
    (storedAccounts ?? []).map((row) => [row.account_id, row.id]),
  );

  const transactionRows = flinksAccounts.flatMap((account) => {
    const accountRowId = accountIdMap.get(account.Id);
    if (!accountRowId) return [];

    return (account.Transactions ?? []).map((transaction) => ({
      user_id: userId,
      account_id: accountRowId,
      transaction_id: transaction.Id,
      name: transaction.Description,
      merchant_name: null,
      amount:
        transaction.Debit != null ? transaction.Debit : -(transaction.Credit ?? 0),
      iso_currency_code: account.Currency ?? "CAD",
      category: null,
      pending: false,
      date: transaction.Date,
    }));
  });

  if (transactionRows.length > 0) {
    const { error } = await admin
      .from("transactions")
      .upsert(transactionRows, { onConflict: "transaction_id" });
    if (error) throw error;
  }

  return {
    accountCount: accountRows.length,
    transactionCount: transactionRows.length,
  };
}
