import { CategoryTransactions } from "@/components/category-transactions";

export default function FitnessPage() {
  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Fitness
      </h2>
      <div className="mt-4">
        <CategoryTransactions category="Fitness" />
      </div>
    </div>
  );
}
