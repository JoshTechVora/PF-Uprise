-- Run this in the Supabase SQL editor for your project.

create extension if not exists vector;

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
  transaction_type text,
  pending boolean not null default false,
  date date not null,
  created_at timestamptz not null default now()
);

-- Migrate an existing `transactions` table (created before transaction_type
-- existed) to add the user-classified category column.
alter table transactions add column if not exists transaction_type text;

-- "Groceries & Food" was split into two separate categories.
update transactions set transaction_type = 'Groceries' where transaction_type = 'Groceries & Food';

-- transaction_type is a user-assigned classification, distinct from
-- `category` (Plaid/Flinks' auto-assigned category). Keep this list in sync
-- with TRANSACTION_CATEGORIES in src/lib/transaction-categories.ts.
alter table transactions drop constraint if exists transactions_transaction_type_chk;
alter table transactions add constraint transactions_transaction_type_chk check (
  transaction_type is null or transaction_type in (
    'Energy', 'Mortgage', 'Groceries', 'Food', 'Coffee', 'Pharmacy', 'Vehicles', 'Fitness'
  )
);

-- Auto-categorization rules: if a transaction's name/merchant_name contains
-- match_text (case-insensitive), it gets assigned `category` when the rule
-- engine runs.
create table if not exists category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_text text not null,
  category text not null,
  created_at timestamptz not null default now()
);

alter table category_rules drop constraint if exists category_rules_category_chk;
alter table category_rules add constraint category_rules_category_chk check (
  category in ('Energy', 'Mortgage', 'Groceries', 'Food', 'Coffee', 'Pharmacy', 'Vehicles', 'Fitness')
);

create unique index if not exists category_rules_user_match_idx
  on category_rules (user_id, lower(match_text));
create index if not exists category_rules_user_id_idx on category_rules (user_id);

alter table category_rules enable row level security;

drop policy if exists "Users manage their own category rules" on category_rules;
create policy "Users manage their own category rules"
  on category_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

-- Uploaded bill documents (currently energy bills) and their indexing
-- status for the RAG pipeline below.
create table if not exists energy_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  extracted_text text,
  status text not null default 'processing',
  error_message text,
  created_at timestamptz not null default now()
);

alter table energy_bills drop constraint if exists energy_bills_status_chk;
alter table energy_bills add constraint energy_bills_status_chk check (
  status in ('processing', 'indexed', 'failed')
);

create index if not exists energy_bills_user_id_idx on energy_bills (user_id);

alter table energy_bills enable row level security;

drop policy if exists "Users manage their own energy bills" on energy_bills;
create policy "Users manage their own energy bills"
  on energy_bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Chunked, embedded text for uploaded documents. source_type/source_id
-- keep this reusable for future document types beyond energy bills.
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

alter table document_chunks drop constraint if exists document_chunks_source_type_chk;
alter table document_chunks add constraint document_chunks_source_type_chk check (
  source_type in ('energy_bill')
);

create index if not exists document_chunks_user_id_idx on document_chunks (user_id);
create index if not exists document_chunks_source_idx on document_chunks (source_type, source_id);
create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table document_chunks enable row level security;

drop policy if exists "Users manage their own document chunks" on document_chunks;
create policy "Users manage their own document chunks"
  on document_chunks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Semantic search over a user's own document chunks: returns the closest
-- matches by cosine distance, expressed as a similarity score.
create or replace function match_document_chunks (
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5,
  p_source_type text default null
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.source_type,
    document_chunks.source_id,
    document_chunks.chunk_index,
    document_chunks.content,
    1 - (document_chunks.embedding <=> p_query_embedding) as similarity
  from document_chunks
  where document_chunks.user_id = p_user_id
    and (p_source_type is null or document_chunks.source_type = p_source_type)
  order by document_chunks.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- Private storage bucket for uploaded bill files; served only via
-- signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('energy-bills', 'energy-bills', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own energy bill files" on storage.objects;
create policy "Users manage their own energy bill files"
  on storage.objects for all
  using (bucket_id = 'energy-bills' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'energy-bills' and (storage.foldername(name))[1] = auth.uid()::text);
