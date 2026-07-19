# PF Uprise

A personal finance tracker built with Next.js, Supabase, and Plaid.

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- Supabase (auth + Postgres, via `@supabase/ssr`)
- Plaid (Link + Transactions) for connecting bank accounts

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com), then run
   [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor to create the
   `plaid_items`, `accounts`, and `transactions` tables with row-level security.

2. **Create a Plaid account** at [dashboard.plaid.com](https://dashboard.plaid.com)
   and grab your sandbox `client_id` and `secret`.

3. Copy `.env.local.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase
     project settings > API Keys.
   - `SUPABASE_SECRET_KEY` — same page. Used only server-side to read/write
     `plaid_items`, which has no client-facing RLS policy (it holds Plaid access
     tokens). Never expose this key to the browser.
   - `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` — Plaid dashboard keys.
     `PLAID_ENV` is `sandbox`, `development`, or `production`.

4. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
   `/login` — sign up, confirm your email (Supabase sends this automatically),
   then sign in to reach `/dashboard` and connect a bank account via Plaid Link.

## How it fits together

- `src/lib/supabase/{client,server,middleware}.ts` — Supabase client helpers for
  browser, server components/route handlers, and middleware.
- `src/lib/supabase/admin.ts` — service-role client for the `plaid_items` table.
- `src/lib/plaid.ts` — Plaid API client.
- `src/lib/plaid-sync.ts` — pulls accounts + last 90 days of transactions for a
  Plaid item and upserts them into Supabase.
- `src/app/api/plaid/*` — route handlers for creating a Link token, exchanging
  the public token after a successful Link flow, and manually re-syncing.
- `src/app/dashboard/page.tsx` — accounts summary, balances, and recent
  transactions.

## Deploy

The easiest way to deploy is [Vercel](https://vercel.com/new). Set the same
environment variables there, and point `PLAID_ENV` at `production` (with
production Plaid keys) once you're ready to connect real accounts.
