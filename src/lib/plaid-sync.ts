import { plaidClient } from "@/lib/plaid";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pulls current accounts and recent transactions for a single Plaid item
 * and upserts them into Supabase, scoped to the owning user.
 */
export async function syncPlaidItem(params: {
  userId: string;
  plaidItemId: string;
  accessToken: string;
}) {
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

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const transactionsResponse = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 250 },
  });

  const transactionRows = transactionsResponse.data.transactions
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
