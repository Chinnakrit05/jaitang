-- Per-month notes on recurring rules.
--
-- Keyed "YYYY-MM" -> text, so one rule can carry a different note for
-- every month it runs. It lives here rather than on the transaction the
-- month materialises because that row's note carries the "[ค่าประจำ]"
-- tag /reports uses to recognise a materialised row (overwriting it
-- would make the row show up a second time as an ordinary
-- transaction), and because a variable-cost bill can want a note before
-- anyone knows the amount.
--
-- Safe to re-run. No existing row changes: every rule starts at {}.

alter table public.recurring_transactions
  add column if not exists month_notes jsonb not null default '{}'::jsonb;
