-- Run this in the Supabase SQL editor for your project.

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  created_at timestamptz not null default now()
);

create table if not exists flinks_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  login_id text not null unique,
  institution_name text,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id uuid references plaid_items (id) on delete cascade,
  flinks_item_id uuid references flinks_items (id) on delete cascade,
  account_id text not null unique,
  name text not null,
  official_name text,
  mask text,
  type text,
  subtype text,
  current_balance numeric,
  available_balance numeric,
  iso_currency_code text,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  transaction_id text not null unique,
  name text not null,
  merchant_name text,
  amount numeric not null,
  iso_currency_code text,
  category text,
  pending boolean not null default false,
  date date not null,
  created_at timestamptz not null default now()
);

-- Migrate an existing `accounts` table (created before flinks_items existed)
-- to allow Flinks-backed accounts.
alter table accounts alter column plaid_item_id drop not null;
alter table accounts add column if not exists flinks_item_id uuid references flinks_items (id) on delete cascade;

create index if not exists transactions_user_id_date_idx on transactions (user_id, date desc);
create index if not exists accounts_user_id_idx on accounts (user_id);
create index if not exists plaid_items_user_id_idx on plaid_items (user_id);
create index if not exists flinks_items_user_id_idx on flinks_items (user_id);

alter table plaid_items enable row level security;
alter table flinks_items enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;

-- No policies are defined for plaid_items or flinks_items: they hold Plaid
-- access tokens and Flinks login IDs, which must never be readable by the
-- client (anon/authenticated roles). All access to these tables happens
-- server-side with the service role key, which bypasses RLS entirely.

-- Every account must belong to exactly one provider.
alter table accounts drop constraint if exists accounts_one_provider_chk;
alter table accounts add constraint accounts_one_provider_chk check (
  (plaid_item_id is not null and flinks_item_id is null) or
  (plaid_item_id is null and flinks_item_id is not null)
);

drop policy if exists "Users manage their own accounts" on accounts;
create policy "Users manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own transactions" on transactions;
create policy "Users manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
