import { CategoryTransactions } from "@/components/category-transactions";
import { isGroupedBySubcategory } from "@/lib/transaction-categories";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const grouped = isGroupedBySubcategory((await searchParams).group);

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Shopping
      </h2>
      <div className="mt-4">
        <CategoryTransactions category="Shopping" groupable grouped={grouped} />
      </div>
    </div>
  );
}
