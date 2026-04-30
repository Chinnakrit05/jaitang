-- Jaitang — Database Schema
-- Run this in Supabase SQL Editor (one-time)

create extension if not exists "uuid-ossp";

-- ============================================================
-- Users (synced from Auth.js / Google OAuth)
-- ============================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  image text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Ledgers (สมุดบัญชี — ส่วนตัว / แชร์)
-- ============================================================
create table if not exists public.ledgers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icon text default '📒',
  color text default '#4cc9f0',
  currency text default 'THB',
  owner_id uuid not null references public.users(id) on delete cascade,
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledgers_owner on public.ledgers(owner_id);

-- ============================================================
-- Ledger members (สมาชิกของสมุดแชร์)
-- ============================================================
create type ledger_role as enum ('owner', 'editor', 'viewer');

create table if not exists public.ledger_members (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role ledger_role not null default 'editor',
  joined_at timestamptz not null default now(),
  unique(ledger_id, user_id)
);

create index if not exists idx_members_ledger on public.ledger_members(ledger_id);
create index if not exists idx_members_user on public.ledger_members(user_id);

-- ============================================================
-- Categories (หมวดหมู่ — ผูกกับสมุด)
-- ============================================================
create type tx_kind as enum ('income', 'expense');

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  icon text default '✨',
  color text default '#94a3b8',
  kind tx_kind not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_ledger on public.categories(ledger_id);

-- ============================================================
-- Transactions (รายการเงินเข้า-ออก)
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind tx_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tx_ledger_occurred on public.transactions(ledger_id, occurred_at desc);
create index if not exists idx_tx_user on public.transactions(user_id);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tx_updated_at on public.transactions;
create trigger trg_tx_updated_at
before update on public.transactions
for each row execute function set_updated_at();

-- ============================================================
-- Invites (ลิงก์เชิญเข้าสมุดแชร์)
-- ============================================================
create table if not exists public.invites (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  code text unique not null,
  role ledger_role not null default 'editor',
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_invites_code on public.invites(code);
create index if not exists idx_invites_ledger on public.invites(ledger_id);

-- ============================================================
-- Budgets (งบประมาณต่อหมวดต่อเดือน)
-- ============================================================
create type budget_period as enum ('month');

create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  period budget_period not null default 'month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ledger_id, category_id, period)
);

create index if not exists idx_budgets_ledger on public.budgets(ledger_id);

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
before update on public.budgets
for each row execute function set_updated_at();

-- ============================================================
-- Recurring transactions (รายการประจำ — เช่น ค่าเช่า ค่าเน็ต)
-- ============================================================
create type recur_period as enum ('daily', 'weekly', 'monthly');

create table if not exists public.recurring_transactions (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind tx_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  period recur_period not null default 'monthly',
  day_of_month int,                       -- 1..31 for monthly (clamps to month length)
  day_of_week int,                        -- 0..6 (Sun..Sat) for weekly
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recur_ledger on public.recurring_transactions(ledger_id);
create index if not exists idx_recur_due on public.recurring_transactions(next_run_at) where active = true;

-- ============================================================
-- Transaction splits (หารบิล — ใครติดเงินคนจ่ายเท่าไหร่)
--
-- A transaction without rows here is "not split" — the payer (transactions.user_id)
-- owns 100%. With rows, each row says "this user owes the payer `amount`".
-- The payer typically does NOT have a row for themselves.
-- ============================================================
create table if not exists public.transaction_splits (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(transaction_id, user_id)
);

create index if not exists idx_splits_tx on public.transaction_splits(transaction_id);
create index if not exists idx_splits_user on public.transaction_splits(user_id);

-- ============================================================
-- Push subscriptions (Web Push API — per device/browser)
-- ============================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

-- ============================================================
-- Helper: is the current user a member of this ledger?
-- (auth.uid() returns the auth.users id; we map via users.id = auth.uid())
-- ============================================================
create or replace function public.is_ledger_member(_ledger_id uuid, _user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.ledgers l
    where l.id = _ledger_id and l.owner_id = _user_id
  ) or exists (
    select 1 from public.ledger_members m
    where m.ledger_id = _ledger_id and m.user_id = _user_id
  );
end;
$$ language plpgsql stable security definer;

create or replace function public.ledger_role_of(_ledger_id uuid, _user_id uuid)
returns ledger_role as $$
declare
  r ledger_role;
begin
  if exists (select 1 from public.ledgers where id = _ledger_id and owner_id = _user_id) then
    return 'owner'::ledger_role;
  end if;
  select role into r from public.ledger_members
    where ledger_id = _ledger_id and user_id = _user_id;
  return r;
end;
$$ language plpgsql stable security definer;

-- ============================================================
-- Row Level Security
-- (Enable on every table. Policies use a custom JWT claim
--  `app_user_id` set by our Next.js server when issuing
--  Supabase access for server actions. For MVP we run all
--  DB calls through the service role from the API layer and
--  enforce auth in app code; RLS below is defense-in-depth.)
-- ============================================================
alter table public.users enable row level security;
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.invites enable row level security;

-- For MVP: deny all by default; service-role bypasses RLS,
-- so anon/authenticated clients see nothing unless we add
-- public.* policies later for direct browser access.

-- ============================================================
-- Seed defaults helper (called on user's first ledger creation)
-- ============================================================
create or replace function public.seed_default_categories(_ledger_id uuid)
returns void as $$
begin
  insert into public.categories (ledger_id, name, icon, color, kind, sort_order) values
    (_ledger_id, 'อาหาร', '🍜', '#f97316', 'expense', 1),
    (_ledger_id, 'เดินทาง', '🚗', '#3b82f6', 'expense', 2),
    (_ledger_id, 'ของใช้', '🛒', '#a855f7', 'expense', 3),
    (_ledger_id, 'บันเทิง', '🎮', '#ec4899', 'expense', 4),
    (_ledger_id, 'สุขภาพ', '💊', '#10b981', 'expense', 5),
    (_ledger_id, 'ที่อยู่อาศัย', '🏠', '#64748b', 'expense', 6),
    (_ledger_id, 'การศึกษา', '📚', '#0ea5e9', 'expense', 7),
    (_ledger_id, 'อื่น ๆ', '✨', '#94a3b8', 'expense', 8),
    (_ledger_id, 'เงินเดือน', '💰', '#22c55e', 'income', 1),
    (_ledger_id, 'โบนัส', '🎁', '#84cc16', 'income', 2),
    (_ledger_id, 'ขายของ', '🏷️', '#14b8a6', 'income', 3),
    (_ledger_id, 'ลงทุน', '📈', '#06b6d4', 'income', 4),
    (_ledger_id, 'อื่น ๆ', '✨', '#94a3b8', 'income', 5);
end;
$$ language plpgsql;
