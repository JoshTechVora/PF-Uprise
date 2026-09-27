import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { GroupBySubcategoryToggle } from "@/components/group-by-subcategory-toggle";
import { TransactionCategorySelect } from "@/components/transaction-category-select";
import { formatCurrency } from "@/lib/format-currency";
import {
  TRANSACTION_SUBCATEGORIES,
  type TransactionCategory,
} from "@/lib/transaction-categories";
import { createClient } from "@/lib/supabase/server";

type Transaction = {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  iso_currency_code: string | null;
  pending: boolean;
  date: string;
  transaction_type: string | null;
  subcategory: string | null;
  accounts: { name: string } | null;
};

function transactionCount(count: number) {
  return `${count} transaction${count === 1 ? "" : "s"}`;
}

function sumSpent(transactions: Transaction[]) {
  return -transactions.reduce((sum, t) => sum + t.amount, 0);
}

export async function CategoryTransactions({
  category,
  groupable = false,
  grouped = false,
}: {
  category: TransactionCategory;
  // Show the "Group by subcategory" checkbox.
  groupable?: boolean;
  grouped?: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, accounts(name)")
    .eq("transaction_type", category)
    .is("deleted_at", null)
    .order("date", { ascending: false });

  const transactions: Transaction[] = data ?? [];

  // Subcategories in the order they're defined, then anything without one.
  const groups = [...TRANSACTION_SUBCATEGORIES[category], null]
    .map((subcategory) => ({
      subcategory,
      transactions: transactions.filter((t) => t.subcategory === subcategory),
    }))
    .filter((group) => group.transactions.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {transactionCount(transactions.length)} · total{" "}
          {formatCurrency(sumSpent(transactions), "USD")}
        </p>
        {groupable && <GroupBySubcategoryToggle checked={grouped} />}
      </div>

      {transactions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No transactions categorized as {category} yet.
        </p>
      ) : grouped ? (
        groups.map((group) => (
          <section key={group.subcategory ?? "none"} className="mt-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {group.subcategory ?? "No subcategory"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {transactionCount(group.transactions.length)} ·{" "}
                {formatCurrency(sumSpent(group.transactions), "USD")}
              </p>
            </div>
            <TransactionList transactions={group.transactions} />
          </section>
        ))
      ) : (
        <div className="mt-2">
          <TransactionList transactions={transactions} />
        </div>
      )}
    </div>
  );
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {transactions.map((transaction) => (
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
  );
}
