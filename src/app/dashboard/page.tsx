import { ConnectBankButton } from "@/components/connect-bank-button";
import { SignOutButton } from "@/components/sign-out-button";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(amount: number | null, currencyCode: string | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
  }).format(amount);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, accounts(name)")
    .order("date", { ascending: false })
    .limit(25);

  const totalBalance = (accounts ?? []).reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0,
  );

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              PF Uprise
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {user?.email}
            </p>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Total balance
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(totalBalance, "USD")}
          </p>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Accounts
            </h2>
            <div className="flex items-center gap-3">
              {(accounts ?? []).length > 0 && <SyncButton />}
              <ConnectBankButton />
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
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
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
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Recent transactions
          </h2>

          {(transactions ?? []).length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No transactions yet.
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
      </div>
    </div>
  );
}
