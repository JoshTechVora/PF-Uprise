import { BackfillButton } from "@/components/backfill-button";
import { CategoryRulesManager } from "@/components/category-rules-manager";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { ConnectWealthsimpleButton } from "@/components/connect-wealthsimple-button";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { SyncButton } from "@/components/sync-button";
import { TransactionCategorySelect } from "@/components/transaction-category-select";
import { TransactionRangeFilter } from "@/components/transaction-range-filter";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/server";

function balanceColorClass(accountType: string | null) {
  if (accountType === "credit" || accountType === "loan") {
    return "text-red-600 dark:text-red-500";
  }
  if (accountType === "investment") {
    return "text-emerald-600 dark:text-emerald-500";
  }
  return "text-zinc-900 dark:text-zinc-50";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const range = (await searchParams).range === "7d" ? "7d" : "30d";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (range === "7d" ? 7 : 30));
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, accounts(name)")
    .is("deleted_at", null)
    .gte("date", cutoffDate)
    .order("date", { ascending: false });

  const { data: categoryRules } = await supabase
    .from("category_rules")
    .select("*")
    .order("created_at", { ascending: true });

  const totalOwed = (accounts ?? [])
    .filter((account) => account.type === "credit" || account.type === "loan")
    .reduce((sum, account) => sum + (account.current_balance ?? 0), 0);

  const totalHave = (accounts ?? [])
    .filter((account) => account.type !== "credit" && account.type !== "loan")
    .reduce((sum, account) => sum + (account.current_balance ?? 0), 0);

  return (
    <>
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Money I have
            </p>
            <p className="mt-1 text-3xl font-semibold text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalHave, "USD")}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Money I owe
            </p>
            <p className="mt-1 text-3xl font-semibold text-red-600 dark:text-red-500">
              {formatCurrency(totalOwed, "USD")}
            </p>
          </div>
        </section>

        <CollapsibleSection
          title="Accounts"
          actions={
            <>
              {(accounts ?? []).length > 0 && <SyncButton />}
              {(accounts ?? []).length > 0 && <BackfillButton />}
              <ConnectBankButton />
              <ConnectWealthsimpleButton />
            </>
          }
        >
          {(accounts ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No accounts connected yet. Connect a bank account to get started.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {(accounts ?? []).map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {account.name}
                      {account.mask ? ` ••••${account.mask}` : ""}
                    </p>
                    <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                      {account.subtype ?? account.type}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium ${balanceColorClass(account.type)}`}
                  >
                    {formatCurrency(
                      account.current_balance,
                      account.iso_currency_code,
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Auto-categorization rules">
          <CategoryRulesManager rules={categoryRules ?? []} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Recent transactions"
          actions={<TransactionRangeFilter selected={range} />}
        >
          {(transactions ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No transactions in this range.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {(transactions ?? []).map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {transaction.merchant_name ?? transaction.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {transaction.date} · {transaction.accounts?.name}
                      {transaction.pending ? " · Pending" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      title="Saved in the database"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 0 1.415l-7.005 7.005a1 1 0 0 1-1.414 0L4.296 9.723a1 1 0 1 1 1.414-1.414l3.283 3.283 6.297-6.298a1 1 0 0 1 1.414-.004Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Stored
                    </span>
                    <TransactionCategorySelect
                      transactionId={transaction.id}
                      category={transaction.transaction_type}
                      subcategory={transaction.subcategory}
                    />
                    <p
                      className={`text-sm font-medium ${
                        transaction.amount > 0
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-emerald-600"
                      }`}
                    >
                      {formatCurrency(
                        -transaction.amount,
                        transaction.iso_currency_code,
                      )}
                    </p>
                    <DeleteTransactionButton
                      transactionId={transaction.id}
                      description={`${transaction.merchant_name ?? transaction.name} · ${formatCurrency(-transaction.amount, transaction.iso_currency_code)} on ${transaction.date}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
    </>
  );
}
