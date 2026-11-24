-- Change history, and a place for the nightly backup.
--
-- 1) change_log — every insert, update and delete on transactions and
--    recurring_transactions, with the row as it was and as it became.
--
--    An amount is edited in place: a recurring month on /reports is one
--    [ค่าประจำ] row whose amount is overwritten, so the moment it changes
--    the old figure is gone. On 24 Nov 2026 "ของใช้ในครัวเรือน" read 949.65
--    and nothing could say what it read before. This keeps the before.
--
--    Who, and through which screen: the server reaches PostgREST with the
--    service-role key, so the database can't tell one user from another.
--    The app sends x-jaitang-actor (users.id) and x-jaitang-via (reports,
--    scan, form, …) as request headers, and PostgREST hands them to the
--    trigger as request.headers. A write from anywhere else — the SQL
--    editor — is still logged, with both left null.
--
-- 2) storage bucket "backups", private, for the JSON the nightly
--    /api/cron/backup route writes (one file per user per day, 30 days).
--
-- Safe to re-run. Changes no existing row.

create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  ledger_id uuid,
  -- Transactions only: when the money happened, so a month's history can
  -- be listed without unpacking jsonb. Null for recurring rules.
  occurred_at timestamptz,
  op text not null check (op in ('insert', 'update', 'delete')),
  old_row jsonb,
  new_row jsonb,
  -- users.id. No foreign key on purpose: removing a user must neither
  -- fail on this table nor take their history with them.
  actor_id uuid,
  via text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_change_log_row
  on public.change_log (row_id, changed_at desc);
create index if not exists idx_change_log_ledger_month
  on public.change_log (ledger_id, occurred_at);

-- Server-only, like every other table here: RLS on, no policies, and no
-- grants to the browser roles. The app reads it with the service role.
alter table public.change_log enable row level security;
revoke all on public.change_log from anon, authenticated;

create or replace function public.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  -- Bookkeeping the app rewrites on its own: updated_at on every write,
  -- and a rule's schedule each time a month is filled. A change to these
  -- alone isn't something anyone would look for in a history.
  v_noise text[] := array['updated_at', 'last_run_at', 'next_run_at', 'last_fill_amount'];
  v_headers jsonb;
  v_actor text;
begin
  if tg_op = 'UPDATE' and (v_old - v_noise) = (v_new - v_noise) then
    return null;
  end if;

  -- PostgREST always sets valid JSON here, but a log that can make a
  -- write fail is worse than a log missing its author.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_actor := v_headers ->> 'x-jaitang-actor';

  insert into public.change_log
    (table_name, row_id, ledger_id, occurred_at, op, old_row, new_row, actor_id, via)
  values (
    tg_table_name,
    (v_row ->> 'id')::uuid,
    (v_row ->> 'ledger_id')::uuid,
    (v_row ->> 'occurred_at')::timestamptz,
    lower(tg_op),
    v_old,
    v_new,
    case
      when v_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then v_actor::uuid
    end,
    left(v_headers ->> 'x-jaitang-via', 32)
  );
  return null;
end;
$$;

create or replace trigger trg_transactions_change_log
  after insert or update or delete on public.transactions
  for each row execute function public.log_row_change();

create or replace trigger trg_recurring_change_log
  after insert or update or delete on public.recurring_transactions
  for each row execute function public.log_row_change();

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
