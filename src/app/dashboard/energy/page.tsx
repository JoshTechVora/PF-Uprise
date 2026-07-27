import { CategoryTransactions } from "@/components/category-transactions";
import { EnergyBillUpload } from "@/components/energy-bill-upload";
import { createClient } from "@/lib/supabase/server";

export default async function EnergyPage() {
  const supabase = await createClient();

  const { data: bills } = await supabase
    .from("energy_bills")
    .select("id, file_name, status, error_message, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Energy
      </h2>

      <div className="mt-4">
        <EnergyBillUpload bills={bills ?? []} />
      </div>

      <div className="mt-8">
        <CategoryTransactions category="Energy" />
      </div>
    </div>
  );
}
