import { ConnectBankButton } from "@/components/connect-bank-button";
import { ConnectWealthsimpleButton } from "@/components/connect-wealthsimple-button";
import { SyncButton } from "@/components/sync-button";
import { TransactionRangeFilter } from "@/components/transaction-range-filter";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(amount: number | null, currencyCode: string | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
  }).format(amount);
}

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
    .gte("date", cutoffDate)
    .order("date", { ascending: false });

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

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Accounts
            </h2>
            <div className="flex items-center gap-3">
              {(accounts ?? []).length > 0 && <SyncButton />}
              <ConnectBankButton />
              <ConnectWealthsimpleButton />
            </div>
          </div>

          {(accounts ?? []).length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No accounts connected yet. Connect a bank account to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
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
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Recent transactions
            </h2>
            <TransactionRangeFilter selected={range} />
          </div>

          {(transactions ?? []).length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No transactions in this range.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
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
                </li>
              ))}
            </ul>
          )}
        </section>
    </>
  );
}
