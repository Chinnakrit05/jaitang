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

-- A user has at most ONE *active* personal ledger. Without this, a race
-- during the first sign-in can spawn duplicates because two concurrent
-- requests both pass the "does it exist?" check before either INSERT
-- lands. The `deleted_at is null` filter lets a user soft-delete their
-- personal ledger and create a new one later.
create unique index if not exists uniq_personal_ledger_per_owner
  on public.ledgers(owner_id)
  where is_personal = true and deleted_at is null;

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

-- Subcategory support: parent_id points to another category in the same
-- ledger. Hierarchy is two levels max (parent → sub); deeper nesting is
-- enforced at the action layer. Deleting a parent promotes its subs to
-- top-level rather than cascading delete (`on delete set null`).
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;
create index if not exists idx_categories_parent on public.categories(parent_id) where parent_id is not null;

-- ============================================================
-- Trips (ทริป — container ชั่วคราว tag รายการ เช่น "ทริปทะเล")
-- ============================================================
create table if not exists public.trips (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  icon text default '✈️',
  color text default '#3b82f6',
  starts_at timestamptz,
  ends_at timestamptz,
  archived boolean not null default false,
  -- Trip's "native" currency. NULL = inherit ledger.currency at runtime.
  -- ISO 4217 (e.g. 'JPY'). When set, new transactions tagged with this trip
  -- default to this currency in the form picker.
  currency text,
  created_at timestamptz not null default now()
);

-- Idempotent migration for existing trips
alter table public.trips
  add column if not exists currency text;

create index if not exists idx_trips_ledger on public.trips(ledger_id);
create index if not exists idx_trips_active on public.trips(ledger_id) where archived = false;

-- ============================================================
-- Accounts / Wallets (บัญชี — เงินสด, ธนาคาร, บัตรเครดิต, e-wallet)
-- Each transaction can optionally link to one account; balance is
-- computed dynamically as initial_balance + Σ(income) - Σ(expense)
-- + Σ(transfers IN) - Σ(transfers OUT) — never persisted, always
-- recomputed from rows.
-- ============================================================
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'credit_card', 'e_wallet')),
  icon text default '💵',
  color text default '#10b981',
  -- Starting balance (e.g. ATM has ฿2,000 cash when you create the account).
  -- Editable later via update.
  initial_balance numeric(14, 2) not null default 0,
  -- ISO 4217 (e.g. 'JPY'). null = inherit ledger.currency.
  currency text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_ledger on public.accounts(ledger_id);
create index if not exists idx_accounts_active on public.accounts(ledger_id) where archived = false;

-- ============================================================
-- Transactions (รายการเงินเข้า-ออก)
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  -- Optional trip association. SET NULL on trip deletion so the user's
  -- transactions survive when they delete a trip — the trip-tag is the
  -- only thing that disappears.
  trip_id uuid references public.trips(id) on delete set null,
  kind tx_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  -- 'cash' | 'transfer' | null (unspecified, e.g. legacy rows)
  payment_method text check (payment_method in ('cash', 'transfer')),
  -- Multi-currency support. `amount` (above) is ALWAYS in the ledger's
  -- home currency. The fx_* trio is metadata for foreign-currency rows:
  --   fx_currency: ISO 4217 code, e.g. 'JPY'
  --   fx_amount:   value in fx_currency the user actually paid
  --   fx_rate:     home / fx ratio at insert time (e.g. 0.2333 for JPY→THB)
  -- All three set together, or all null (= row is in home currency).
  fx_currency text,
  fx_amount numeric(14, 2),
  fx_rate numeric(18, 8),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fx_fields_consistent check (
    (fx_currency is null and fx_amount is null and fx_rate is null) or
    (fx_currency is not null and fx_amount is not null and fx_rate is not null)
  )
);

-- Idempotent migration for existing deployments where the columns did not exist.
alter table public.transactions
  add column if not exists payment_method text
  check (payment_method in ('cash', 'transfer'));
alter table public.transactions
  add column if not exists trip_id uuid references public.trips(id) on delete set null;
alter table public.transactions
  add column if not exists fx_currency text;
alter table public.transactions
  add column if not exists fx_amount numeric(14, 2);
alter table public.transactions
  add column if not exists fx_rate numeric(18, 8);
-- Optional account link. SET NULL on account delete so transactions
-- survive an account being removed (matches how trip_id behaves).
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
create index if not exists idx_tx_account on public.transactions(account_id) where account_id is not null;

-- Add the consistency check separately so it doesn't fail on re-runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fx_fields_consistent'
  ) then
    alter table public.transactions
      add constraint fx_fields_consistent check (
        (fx_currency is null and fx_amount is null and fx_rate is null) or
        (fx_currency is not null and fx_amount is not null and fx_rate is not null)
      );
  end if;
end $$;

create index if not exists idx_tx_ledger_occurred on public.transactions(ledger_id, occurred_at desc);
create index if not exists idx_tx_user on public.transactions(user_id);
create index if not exists idx_tx_trip on public.transactions(trip_id) where trip_id is not null;

-- Soft delete so the mobile sync engine can propagate deletions in
-- either direction (last-write-wins by `updated_at`). Web `delete*`
-- helpers now do UPDATE deleted_at = now() instead of DELETE; SELECTs
-- filter on `deleted_at is null`.
alter table public.transactions
  add column if not exists deleted_at timestamptz;
create index if not exists idx_tx_active
  on public.transactions(ledger_id, occurred_at desc)
  where deleted_at is null;

-- Per-month overrides for recurring rules — the /reports inline editor
-- materializes one tx per (rule, month) so changing this month's amount
-- never touches the rule template or other months. `recurring_id` links
-- the materialized row back to its rule (null = ordinary tx). `skipped`
-- + amount = 0 means "no value this month" (renders as "-" on /reports
-- and counts as 0 in totals). Both nullable for backfill safety.
alter table public.transactions
  add column if not exists recurring_id uuid
  references public.recurring_transactions(id) on delete set null;
alter table public.transactions
  add column if not exists skipped boolean not null default false;
create index if not exists idx_tx_recurring
  on public.transactions(recurring_id, occurred_at)
  where recurring_id is not null;

-- Allow zero-amount rows so a /reports skip can be stored as a 0-amount
-- override tx. The original > 0 constraint pre-dates the skip flow.
do $$
begin
  alter table public.transactions
    drop constraint if exists transactions_amount_check;
  alter table public.transactions
    add constraint transactions_amount_check check (amount >= 0);
exception when others then null;
end $$;

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
-- Sync metadata for categories / accounts / ledgers
-- Mobile pulls with `updated_at > since`; deletions propagate via the
-- `deleted_at` tombstone (same pattern as transactions above) so an
-- offline client picks up removals on its next sync instead of seeing
-- a stale row forever. Partial indexes keep the active-row queries fast.
-- ============================================================
alter table public.categories
  add column if not exists updated_at timestamptz not null default now();
alter table public.categories
  add column if not exists deleted_at timestamptz;
drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function set_updated_at();
create index if not exists idx_categories_active
  on public.categories(ledger_id, kind, sort_order)
  where deleted_at is null;

alter table public.accounts
  add column if not exists updated_at timestamptz not null default now();
alter table public.accounts
  add column if not exists deleted_at timestamptz;
drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function set_updated_at();
create index if not exists idx_accounts_live
  on public.accounts(ledger_id)
  where deleted_at is null and archived = false;

alter table public.ledgers
  add column if not exists updated_at timestamptz not null default now();
alter table public.ledgers
  add column if not exists deleted_at timestamptz;
alter table public.ledgers
  add column if not exists default_payment_method text
    check (default_payment_method in ('cash', 'transfer'));
drop trigger if exists trg_ledgers_updated_at on public.ledgers;
create trigger trg_ledgers_updated_at
before update on public.ledgers
for each row execute function set_updated_at();
create index if not exists idx_ledgers_active
  on public.ledgers(owner_id)
  where deleted_at is null;

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
create type recur_period as enum ('daily', 'weekly', 'monthly', 'yearly');
-- Existing deployments (created before 'yearly' was added) need this:
do $$ begin
  alter type recur_period add value if not exists 'yearly';
exception when duplicate_object then null;
end $$;

create table if not exists public.recurring_transactions (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind tx_kind not null,
  -- Nullable so users can set up rules for variable-cost bills (ค่าไฟ, ค่าน้ำ)
  -- and fill the amount in only when the bill arrives. The check still rejects
  -- zero/negative values when an amount IS provided.
  amount numeric(14, 2) check (amount is null or amount > 0),
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

-- v2 columns: optionally pin a recurring rule to an account / trip /
-- foreign currency so the materialized tx already has the right tags.
-- Idempotent for existing deployments.
alter table public.recurring_transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.recurring_transactions
  add column if not exists trip_id uuid references public.trips(id) on delete set null;
alter table public.recurring_transactions
  add column if not exists fx_currency text;
create index if not exists idx_recur_account on public.recurring_transactions(account_id) where account_id is not null;
create index if not exists idx_recur_trip on public.recurring_transactions(trip_id) where trip_id is not null;

-- v3: amount became nullable (variable-cost bills). Existing deployments
-- need both the NOT NULL drop and the relaxed check constraint applied.
do $$ begin
  alter table public.recurring_transactions alter column amount drop not null;
exception when others then null;
end $$;
do $$ begin
  alter table public.recurring_transactions
    drop constraint if exists recurring_transactions_amount_check;
  alter table public.recurring_transactions
    add constraint recurring_transactions_amount_check
    check (amount is null or amount > 0);
exception when others then null;
end $$;

-- v4: remember the most recent fill amount for variable-cost rules so
-- the UI can render the value the user just typed when they return to
-- the page. The rule's own `amount` stays null on purpose — variable
-- bills are meant to prompt every cycle — but we don't want the
-- display to look empty between fill and next cycle.
alter table public.recurring_transactions
  add column if not exists last_fill_amount numeric;

-- v5: user-controlled order of recurring rules on the list page.
-- Default 0 leaves existing rules in their original next_run_at
-- order; reordering writes increasing values. Same shape as
-- categories.sort_order.
alter table public.recurring_transactions
  add column if not exists sort_order int not null default 0;
create index if not exists idx_recur_ledger_order
  on public.recurring_transactions(ledger_id, sort_order);

-- v6: soft delete — same `deleted_at` tombstone pattern as transactions.
-- The trash action used to hard-DELETE the row, so one mistapped confirm
-- destroyed the rule with no recovery path (schedule, category link and
-- variable-bill mode all gone). deleteRecurring() now writes
-- `deleted_at = now()` and every read filters `deleted_at is null`;
-- restoreRecurring() clears the stamp to power the post-delete undo.
alter table public.recurring_transactions
  add column if not exists deleted_at timestamptz;
create index if not exists idx_recur_active
  on public.recurring_transactions(ledger_id)
  where deleted_at is null;

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
-- Transfers (โอนระหว่างบัญชีตัวเอง — ไม่ใช่ income/expense)
-- Cross-currency support: from/to amounts + currencies stored
-- separately so a Wise-style THB→JPY transfer keeps both legs.
-- For same-currency transfers, from_amount == to_amount and
-- fx_rate == 1.
-- ============================================================
create table if not exists public.transfers (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid not null references public.accounts(id) on delete cascade,
  from_amount numeric(14, 2) not null check (from_amount > 0),
  from_currency text not null,
  to_amount numeric(14, 2) not null check (to_amount > 0),
  to_currency text not null,
  -- to_amount / from_amount at submit time. Stored for audit + display.
  fx_rate numeric(18, 8) not null check (fx_rate > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (from_account_id != to_account_id)
);

create index if not exists idx_transfers_ledger on public.transfers(ledger_id);
create index if not exists idx_transfers_from on public.transfers(from_account_id);
create index if not exists idx_transfers_to on public.transfers(to_account_id);

-- ============================================================
-- Goals (เป้าหมายการออม — เช่น "ทริปเกาหลี 100k")
-- ============================================================
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  icon text default '🎯',
  color text default '#10b981',
  target_amount numeric(14, 2) not null check (target_amount > 0),
  deadline timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_goals_ledger on public.goals(ledger_id);
create index if not exists idx_goals_active on public.goals(ledger_id) where archived = false;

-- ============================================================
-- Goal contributions (ออมเข้าเป้าหมาย — รายครั้ง)
-- Stored separately from `transactions` so contributions don't
-- pollute income/expense totals. Each contribution is one row;
-- progress = sum(amount) per goal.
-- ============================================================
create table if not exists public.goal_contributions (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_contrib_goal on public.goal_contributions(goal_id);

-- ============================================================
-- Loans (เงินยืม — ให้ยืม / ขอยืม)
-- Track outstanding balances with someone OUTSIDE the ledger system —
-- e.g. lent ฿1000 to a friend, borrowed ฿500 from mom. Different from
-- transaction_splits (which is for in-app shared bills). Repayments
-- are partial; status = 'open' until total repaid >= principal, then
-- 'settled'. Currency-agnostic.
-- ============================================================
create type loan_kind as enum ('lent', 'borrowed');
create type loan_status as enum ('open', 'settled');

create table if not exists public.loans (
  id uuid primary key default uuid_generate_v4(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  kind loan_kind not null,
  -- Free-text counterparty name. Loans are with people outside the
  -- system, so we don't try to map to a user_id.
  counterparty text not null,
  principal numeric(14, 2) not null check (principal > 0),
  currency text not null default 'THB',
  started_at timestamptz not null default now(),
  due_date timestamptz,
  status loan_status not null default 'open',
  settled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_loans_ledger on public.loans(ledger_id);
create index if not exists idx_loans_open on public.loans(ledger_id) where status = 'open';

-- ============================================================
-- Loan repayments — partial payments against a loan. Each row pays
-- down `loans.principal`; when sum >= principal, app marks the loan
-- as 'settled'.
-- ============================================================
create table if not exists public.loan_repayments (
  id uuid primary key default uuid_generate_v4(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_loan_repay_loan on public.loan_repayments(loan_id);

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
alter table public.trips enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.accounts enable row level security;
alter table public.transfers enable row level security;
alter table public.loans enable row level security;
alter table public.loan_repayments enable row level security;

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
