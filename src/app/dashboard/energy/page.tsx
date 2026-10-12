import { CategoryTransactions } from "@/components/category-transactions";
import { EnergyBillUpload } from "@/components/energy-bill-upload";
import { GoogleDriveFolderSync } from "@/components/google-drive-folder-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function EnergyPage({
  searchParams,
}: {
  searchParams: Promise<{ google_drive?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bills } = await supabase
    .from("energy_bills")
    .select("id, file_name, status, error_message, created_at")
    .order("created_at", { ascending: false });

  // google_drive_connections has no client-facing RLS policy (it holds tokens),
  // so read it with the admin client and select only the display fields.
  const { data: googleDriveConnection } = user
    ? await createAdminClient()
        .from("google_drive_connections")
        .select("account_email")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: energyFolder } = await supabase
    .from("drive_folders")
    .select("folder_name, last_synced_at")
    .eq("category", "Energy")
    .maybeSingle();

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Energy
      </h2>

      <div className="mt-4">
        <GoogleDriveFolderSync
          category="Energy"
          connection={googleDriveConnection}
          folder={energyFolder}
          status={(await searchParams).google_drive}
        />
      </div>

      <div className="mt-4">
        <EnergyBillUpload bills={bills ?? []} />
      </div>

      <div className="mt-8">
        <CategoryTransactions category="Energy" />
      </div>
    </div>
  );
}
