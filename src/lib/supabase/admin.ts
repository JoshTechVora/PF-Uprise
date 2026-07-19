import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Secret-key client for server-only code paths that must read/write
 * tables with no client-facing RLS policy (e.g. plaid_items, which holds
 * Plaid access tokens). Never import this into client components.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
