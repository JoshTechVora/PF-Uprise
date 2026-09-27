import { CategoryTransactions } from "@/components/category-transactions";
import { isGroupedBySubcategory } from "@/lib/transaction-categories";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const grouped = isGroupedBySubcategory((await searchParams).group);

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Vehicles
      </h2>
      <div className="mt-4">
        <CategoryTransactions category="Vehicles" groupable grouped={grouped} />
      </div>
    </div>
  );
}
