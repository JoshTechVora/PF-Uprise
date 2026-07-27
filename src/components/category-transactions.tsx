import { TransactionCategorySelect } from "@/components/transaction-category-select";
import { formatCurrency } from "@/lib/format-currency";
import type { TransactionCategory } from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

export async function CategoryTransactions({
  category,
}: {
  category: TransactionCategory;
}) {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, accounts(name)")
    .eq("transaction_type", category)
    .order("date", { ascending: false });

  const total = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {(transactions ?? []).length} transaction
        {(transactions ?? []).length === 1 ? "" : "s"} · total{" "}
        {formatCurrency(-total, "USD")}
      </p>

      {(transactions ?? []).length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No transactions categorized as {category} yet.
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
              <div className="flex items-center gap-3">
                <TransactionCategorySelect
                  transactionId={transaction.id}
                  category={transaction.transaction_type}
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
