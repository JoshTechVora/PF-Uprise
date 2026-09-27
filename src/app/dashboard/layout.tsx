import { DashboardShell } from "@/components/dashboard-shell";
import { SidebarNav } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { TransactionChat } from "@/components/transaction-chat";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="flex gap-8 py-10 pl-6">
        <aside className="w-48 shrink-0">
          <h1 className="px-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            PF Uprise
          </h1>
          <p className="mb-6 px-3 text-xs text-zinc-500 dark:text-zinc-400">
            {user?.email}
          </p>
          <SidebarNav />
          <div className="mt-6 px-3">
            <SignOutButton />
          </div>
          <div className="mt-4 px-3">
            <ThemeToggle />
          </div>
        </aside>

        <DashboardShell main={children} chat={<TransactionChat />} />
      </div>
    </div>
  );
}
