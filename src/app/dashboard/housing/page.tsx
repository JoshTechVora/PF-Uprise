import { CategoryTransactions } from "@/components/category-transactions";

export default function HousingPage() {
  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Housing
      </h2>
      <div className="mt-4">
        <CategoryTransactions category="Housing" />
      </div>
    </div>
  );
}
