-- Run this in the Supabase SQL editor for your project.

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id uuid not null references plaid_items (id) on delete cascade,
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

create index if not exists transactions_user_id_date_idx on transactions (user_id, date desc);
create index if not exists accounts_user_id_idx on accounts (user_id);
create index if not exists plaid_items_user_id_idx on plaid_items (user_id);

alter table plaid_items enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;

-- No policies are defined for plaid_items: it holds Plaid access tokens,
-- which must never be readable by the client (anon/authenticated roles).
-- All access to this table happens server-side with the service role key,
-- which bypasses RLS entirely.

create policy "Users manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
