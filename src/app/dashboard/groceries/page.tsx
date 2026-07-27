import { CategoryTransactions } from "@/components/category-transactions";

export default function GroceriesPage() {
  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Groceries
      </h2>
      <div className="mt-4">
        <CategoryTransactions category="Groceries" />
      </div>
    </div>
  );
}
