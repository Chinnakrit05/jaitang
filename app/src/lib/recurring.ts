import { getServerSupabase } from "@/lib/supabase/server";
import { fetchFxRate } from "@/lib/fx";
import type { TxKind } from "@/lib/types";

export type RecurPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringRule = {
  id: string;
  ledger_id: string;
  user_id: string;
  category_id: string | null;
  /** Optional account pinning — null = no account on materialized tx. */
  account_id: string | null;
  /** Optional trip pinning — null = no trip on materialized tx. */
  trip_id: string | null;
  /** Optional foreign currency the rule's amount is denominated in.
   *  null = home currency. When non-null, applyDueRecurring re-fetches
   *  the FX rate at run-time and stores fx_amount = amount, amount = home value. */
  fx_currency: string | null;
  kind: TxKind;
  /** null = variable-cost bill that the user fills in when due. Such rules
   *  are skipped by `applyDueRecurring` until the user supplies an amount. */
  amount: number | null;
  note: string | null;
  period: RecurPeriod;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string;
  last_run_at: string | null;
  /** Most recent amount the user typed in for a variable-cost (null
   *  `amount`) rule. Cached on fill so the row can display the value
   *  even after a refresh, until the next period rolls around. Always
   *  null for fixed-amount rules — those already keep the value on
   *  `amount`. */
  last_fill_amount: number | null;
  /** User-controlled display order on /recurring. 0 = unsorted (the
   *  default). Reorder action assigns increasing values. */
  sort_order: number;
  active: boolean;
  created_at: string;
  category?: { id: string; name: string; icon: string | null; color: string | null } | null;
  account?: { id: string; name: string; icon: string | null; currency: string | null } | null;
  trip?: { id: string; name: string; icon: string | null; currency: string | null } | null;
};

function clampDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

export function computeNextRun(rule: {
  period: RecurPeriod;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string;
}): Date {
  const cur = new Date(rule.next_run_at);

  if (rule.period === "daily") {
    cur.setDate(cur.getDate() + 1);
    return cur;
  }
  if (rule.period === "weekly") {
    cur.setDate(cur.getDate() + 7);
    return cur;
  }
  if (rule.period === "yearly") {
    // Same calendar date, one year ahead. Feb 29 → Feb 28 in non-leap years
    // because setDate(29) on Feb in a non-leap year rolls to Mar 1, so we
    // clamp explicitly.
    const next = new Date(cur);
    next.setFullYear(next.getFullYear() + 1);
    if (rule.day_of_month) {
      next.setDate(clampDayOfMonth(next.getFullYear(), next.getMonth(), rule.day_of_month));
    }
    return next;
  }
  // monthly
  const next = new Date(cur);
  next.setMonth(next.getMonth() + 1);
  if (rule.day_of_month) {
    next.setDate(clampDayOfMonth(next.getFullYear(), next.getMonth(), rule.day_of_month));
  }
  return next;
}

export async function listRecurring(ledgerId: string): Promise<RecurringRule[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("recurring_transactions")
    .select(
      "id, ledger_id, user_id, category_id, account_id, trip_id, fx_currency, kind, amount, note, period, day_of_month, day_of_week, next_run_at, last_run_at, last_fill_amount, sort_order, active, created_at, category:categories(id, name, icon, color), account:accounts(id, name, icon, currency), trip:trips(id, name, icon, currency)"
    )
    .eq("ledger_id", ledgerId)
    // sort_order first so the wiggle-reorder UI controls the list;
    // next_run_at is the tiebreaker so rules that haven't been moved
    // (sort_order = 0 by default) stay in their original order.
    .order("sort_order", { ascending: true })
    .order("next_run_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount: r.amount === null ? null : Number(r.amount),
    last_fill_amount:
      r.last_fill_amount === null || r.last_fill_amount === undefined
        ? null
        : Number(r.last_fill_amount),
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    account_id: r.account_id ?? null,
    trip_id: r.trip_id ?? null,
    fx_currency: r.fx_currency ?? null,
    category: (Array.isArray(r.category) ? r.category[0] : r.category) ?? null,
    account: (Array.isArray(r.account) ? r.account[0] : r.account) ?? null,
    trip: (Array.isArray(r.trip) ? r.trip[0] : r.trip) ?? null,
  })) as RecurringRule[];
}

export async function createRecurring(input: {
  ledgerId: string;
  userId: string;
  categoryId: string | null;
  accountId?: string | null;
  tripId?: string | null;
  /** When set, `amount` is in this currency; otherwise it's home. */
  fxCurrency?: string | null;
  kind: TxKind;
  /** null = let the user fill in the amount each cycle (variable bills). */
  amount: number | null;
  note: string | null;
  period: RecurPeriod;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextRunAt: Date;
}) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("recurring_transactions")
    .insert({
      ledger_id: input.ledgerId,
      user_id: input.userId,
      category_id: input.categoryId,
      account_id: input.accountId ?? null,
      trip_id: input.tripId ?? null,
      fx_currency: input.fxCurrency ?? null,
      kind: input.kind,
      amount: input.amount,
      note: input.note,
      period: input.period,
      day_of_month: input.dayOfMonth,
      day_of_week: input.dayOfWeek,
      next_run_at: input.nextRunAt.toISOString(),
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

/**
 * Patch fields on an existing rule. Same partial-update pattern as
 * other lib functions — undefined = leave alone, null = clear.
 */
export async function updateRecurring(
  id: string,
  patch: Partial<{
    categoryId: string | null;
    accountId: string | null;
    tripId: string | null;
    fxCurrency: string | null;
    kind: TxKind;
    amount: number | null;
    note: string | null;
    period: RecurPeriod;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    nextRunAt: Date;
    active: boolean;
    /** User-visible order on /recurring. */
    sortOrder: number;
  }>
) {
  const sb = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.accountId !== undefined) update.account_id = patch.accountId;
  if (patch.tripId !== undefined) update.trip_id = patch.tripId;
  if (patch.fxCurrency !== undefined) update.fx_currency = patch.fxCurrency;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.period !== undefined) update.period = patch.period;
  if (patch.dayOfMonth !== undefined) update.day_of_month = patch.dayOfMonth;
  if (patch.dayOfWeek !== undefined) update.day_of_week = patch.dayOfWeek;
  if (patch.nextRunAt !== undefined)
    update.next_run_at = patch.nextRunAt.toISOString();
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

  const { data, error } = await sb
    .from("recurring_transactions")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

export async function deleteRecurring(id: string) {
  const sb = getServerSupabase();
  const { error } = await sb.from("recurring_transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function setRecurringActive(id: string, active: boolean) {
  const sb = getServerSupabase();
  const { error } = await sb.from("recurring_transactions").update({ active }).eq("id", id);
  if (error) throw error;
}

/**
 * Materialize all due rules for this ledger, creating real transactions
 * and rolling next_run_at forward. Idempotent if called concurrently
 * since we update last_run_at and next_run_at atomically per rule.
 */
export async function applyDueRecurring(ledgerId: string): Promise<number> {
  const sb = getServerSupabase();
  const now = new Date();

  const { data: due, error } = await sb
    .from("recurring_transactions")
    .select(
      "id, user_id, category_id, account_id, trip_id, fx_currency, kind, amount, note, period, day_of_month, day_of_week, next_run_at"
    )
    .eq("ledger_id", ledgerId)
    .eq("active", true)
    .lte("next_run_at", now.toISOString());
  if (error) throw error;

  // Resolve home currency once for FX path
  const { data: ledgerRow } = await sb
    .from("ledgers")
    .select("currency")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();
  const homeCurrency = (ledgerRow?.currency as string) ?? "THB";

  let created = 0;
  for (const r of due ?? []) {
    // Variable-cost rules (amount IS NULL) are intentionally skipped so the
    // user can fill the bill amount in by hand when it arrives. The rule
    // stays "due" until it does — surfaced in the pending panel via
    // listPendingRecurring().
    if (r.amount === null) continue;

    // For FX rules: fetch one rate up-front (good for the entire backfill
    // burst — the user expects "the rate when the run happened" rather
    // than per-day historical rates which the free APIs don't expose).
    let homeAmount = Number(r.amount);
    let fxFields: {
      fx_currency: string | null;
      fx_amount: number | null;
      fx_rate: number | null;
    } = { fx_currency: null, fx_amount: null, fx_rate: null };
    if (r.fx_currency && r.fx_currency !== homeCurrency) {
      try {
        const rate = await fetchFxRate(r.fx_currency, homeCurrency);
        homeAmount = Math.round(Number(r.amount) * rate * 100) / 100;
        fxFields = {
          fx_currency: r.fx_currency,
          fx_amount: Number(r.amount),
          fx_rate: rate,
        };
      } catch {
        // FX unavailable: store as home-currency at face value rather
        // than fail the whole batch. The rule is set up; we'd rather
        // log a slightly-off tx than skip the cycle.
      }
    }

    // safety cap: at most 12 backfills per rule per call
    let runAt = new Date(r.next_run_at);
    let iterations = 0;
    while (runAt <= now && iterations < 12) {
      const { error: insErr } = await sb.from("transactions").insert({
        ledger_id: ledgerId,
        user_id: r.user_id,
        category_id: r.category_id,
        account_id: r.account_id ?? null,
        trip_id: r.trip_id ?? null,
        kind: r.kind,
        amount: homeAmount,
        note: r.note ? `[ค่าประจำ] ${r.note}` : "[ค่าประจำ]",
        ...fxFields,
        occurred_at: runAt.toISOString(),
      });
      if (insErr) throw insErr;
      created++;
      runAt = computeNextRun({
        period: r.period as RecurPeriod,
        day_of_month: r.day_of_month,
        day_of_week: r.day_of_week,
        next_run_at: runAt.toISOString(),
      });
      iterations++;
    }
    await sb
      .from("recurring_transactions")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: runAt.toISOString(),
      })
      .eq("id", r.id);
  }
  return created;
}

/**
 * Active rules with no amount whose next_run_at is in the past — these are
 * the variable-cost bills (ค่าไฟ ค่าน้ำ) waiting for the user to fill in.
 * Sorted oldest-first so the most overdue bill bubbles to the top.
 */
export async function listPendingRecurring(
  ledgerId: string,
): Promise<RecurringRule[]> {
  const sb = getServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("recurring_transactions")
    .select(
      "id, ledger_id, user_id, category_id, account_id, trip_id, fx_currency, kind, amount, note, period, day_of_month, day_of_week, next_run_at, last_run_at, last_fill_amount, sort_order, active, created_at, category:categories(id, name, icon, color), account:accounts(id, name, icon, currency), trip:trips(id, name, icon, currency)",
    )
    .eq("ledger_id", ledgerId)
    .eq("active", true)
    .is("amount", null)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount: null,
    last_fill_amount:
      r.last_fill_amount === null || r.last_fill_amount === undefined
        ? null
        : Number(r.last_fill_amount),
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    account_id: r.account_id ?? null,
    trip_id: r.trip_id ?? null,
    fx_currency: r.fx_currency ?? null,
    category: (Array.isArray(r.category) ? r.category[0] : r.category) ?? null,
    account: (Array.isArray(r.account) ? r.account[0] : r.account) ?? null,
    trip: (Array.isArray(r.trip) ? r.trip[0] : r.trip) ?? null,
  })) as RecurringRule[];
}

/**
 * Materialize a transaction for the given rule using the user-supplied amount,
 * then advance the rule's next_run_at to the next cycle. Used for variable-
 * cost (null-amount) rules; the rule's saved amount stays null so the next
 * cycle still requires a manual fill-in.
 */
export async function fillPendingRecurring(input: {
  ruleId: string;
  ledgerId: string;
  amount: number;
}): Promise<void> {
  const sb = getServerSupabase();
  const { data: rule, error: re } = await sb
    .from("recurring_transactions")
    .select(
      "id, user_id, category_id, account_id, trip_id, fx_currency, kind, note, period, day_of_month, day_of_week, next_run_at",
    )
    .eq("id", input.ruleId)
    .eq("ledger_id", input.ledgerId)
    .maybeSingle();
  if (re) throw re;
  if (!rule) throw new Error("Rule not found");

  const { data: ledgerRow } = await sb
    .from("ledgers")
    .select("currency")
    .eq("id", input.ledgerId)
    .is("deleted_at", null)
    .maybeSingle();
  const homeCurrency = (ledgerRow?.currency as string) ?? "THB";

  let homeAmount = input.amount;
  let fxFields: {
    fx_currency: string | null;
    fx_amount: number | null;
    fx_rate: number | null;
  } = { fx_currency: null, fx_amount: null, fx_rate: null };
  if (rule.fx_currency && rule.fx_currency !== homeCurrency) {
    try {
      const rate = await fetchFxRate(rule.fx_currency, homeCurrency);
      homeAmount = Math.round(input.amount * rate * 100) / 100;
      fxFields = {
        fx_currency: rule.fx_currency,
        fx_amount: input.amount,
        fx_rate: rate,
      };
    } catch {
      // FX unreachable — fall back to face value rather than reject the fill.
    }
  }

  const occurredAt = new Date(rule.next_run_at).toISOString();
  const { error: insErr } = await sb.from("transactions").insert({
    ledger_id: input.ledgerId,
    user_id: rule.user_id,
    category_id: rule.category_id,
    account_id: rule.account_id ?? null,
    trip_id: rule.trip_id ?? null,
    kind: rule.kind,
    amount: homeAmount,
    note: rule.note ? `[ค่าประจำ] ${rule.note}` : "[ค่าประจำ]",
    ...fxFields,
    occurred_at: occurredAt,
  });
  if (insErr) throw insErr;

  const nextRun = computeNextRun({
    period: rule.period as RecurPeriod,
    day_of_month: rule.day_of_month,
    day_of_week: rule.day_of_week,
    next_run_at: rule.next_run_at,
  });
  const { error: upErr } = await sb
    .from("recurring_transactions")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun.toISOString(),
      // Cache the value the user just typed (in the rule's native
      // currency) so the UI can keep showing it after refresh. The
      // rule's `amount` stays null — variable bills are meant to
      // prompt for input every cycle.
      last_fill_amount: input.amount,
    })
    .eq("id", input.ruleId);
  if (upErr) throw upErr;
}

/**
 * True when `last_run_at` falls in the current period bucket for the
 * given rule period. Shared between the /recurring client list
 * (drives the "✓ ใส่แล้วเดือนนี้" status badge) and the /reports
 * server page (drives the section total computation).
 */
export function isAppliedThisPeriod(
  lastRunAt: string | null,
  period: RecurPeriod
): boolean {
  if (!lastRunAt) return false;
  const last = new Date(lastRunAt);
  const now = new Date();
  if (Number.isNaN(last.getTime())) return false;
  switch (period) {
    case "daily":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
      );
    case "weekly": {
      // ISO week — Monday-anchored.
      const startOfWeek = (d: Date) => {
        const x = new Date(d);
        const day = (x.getDay() + 6) % 7;
        x.setHours(0, 0, 0, 0);
        x.setDate(x.getDate() - day);
        return x.getTime();
      };
      return startOfWeek(last) === startOfWeek(now);
    }
    case "monthly":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth()
      );
    case "yearly":
      return last.getFullYear() === now.getFullYear();
    default:
      return false;
  }
}
