import { plaidClient } from "@/lib/plaid";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAID_MAX_PAGE_SIZE = 500;
const UPSERT_CHUNK_SIZE = 500;

// Plaid's transactionsGet is paginated: each call returns up to
// PLAID_MAX_PAGE_SIZE transactions plus the true total, so a full pull
// requires looping with increasing offsets until everything is fetched.
async function fetchAllTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
) {
  const transactions: Awaited<
    ReturnType<typeof plaidClient.transactionsGet>
  >["data"]["transactions"] = [];
  let offset = 0;

  while (true) {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: PLAID_MAX_PAGE_SIZE, offset },
    });

    transactions.push(...response.data.transactions);
    offset += response.data.transactions.length;

    if (
      response.data.transactions.length === 0 ||
      offset >= response.data.total_transactions
    ) {
      break;
    }
  }

  return transactions;
}

/**
 * Pulls current accounts and transactions for a single Plaid item and
 * upserts them into Supabase, scoped to the owning user. By default this
 * only looks at the last 90 days (fast, for the regular "Refresh" button).
 * Pass `historical: true` to pull Plaid's full available history instead
 * (used by the "Backfill full history" button) — upserting by
 * transaction_id means already-stored transactions are updated in place,
 * never duplicated.
 */
export async function syncPlaidItem(
  params: {
    userId: string;
    plaidItemId: string;
    accessToken: string;
  },
  options?: { historical?: boolean },
) {
  const { userId, plaidItemId, accessToken } = params;
  const admin = createAdminClient();

  const accountsResponse = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  const accountRows = accountsResponse.data.accounts.map((account) => ({
    user_id: userId,
    plaid_item_id: plaidItemId,
    account_id: account.account_id,
    name: account.name,
    official_name: account.official_name,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
    current_balance: account.balances.current,
    available_balance: account.balances.available,
    iso_currency_code: account.balances.iso_currency_code,
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
    .eq("plaid_item_id", plaidItemId);
  if (accountsFetchError) throw accountsFetchError;

  const accountIdMap = new Map(
    (storedAccounts ?? []).map((row) => [row.account_id, row.id]),
  );

  const historyDays = options?.historical ? 730 : 90;
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const plaidTransactions = await fetchAllTransactions(
    accessToken,
    startDate,
    endDate,
  );

  const transactionRows = plaidTransactions
    .filter((transaction) => accountIdMap.has(transaction.account_id))
    .map((transaction) => ({
      user_id: userId,
      account_id: accountIdMap.get(transaction.account_id),
      transaction_id: transaction.transaction_id,
      name: transaction.name,
      merchant_name: transaction.merchant_name,
      amount: transaction.amount,
      iso_currency_code: transaction.iso_currency_code,
      category: transaction.personal_finance_category?.primary ?? null,
      pending: transaction.pending,
      date: transaction.date,
    }));

  for (let i = 0; i < transactionRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = transactionRows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await admin
      .from("transactions")
      .upsert(chunk, { onConflict: "transaction_id" });
    if (error) throw error;
  }

  return {
    accountCount: accountRows.length,
    transactionCount: transactionRows.length,
  };
}
