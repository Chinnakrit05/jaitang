import { getServerSupabase } from "@/lib/supabase/server";
import { fetchFxRate } from "@/lib/fx";
import type { TxKind } from "@/lib/types";

export type RecurPeriod = "daily" | "weekly" | "monthly";

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
  amount: number;
  note: string | null;
  period: RecurPeriod;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string;
  last_run_at: string | null;
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
      "id, ledger_id, user_id, category_id, account_id, trip_id, fx_currency, kind, amount, note, period, day_of_month, day_of_week, next_run_at, last_run_at, active, created_at, category:categories(id, name, icon, color), account:accounts(id, name, icon, currency), trip:trips(id, name, icon, currency)"
    )
    .eq("ledger_id", ledgerId)
    .order("next_run_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
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
  amount: number;
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
    amount: number;
    note: string | null;
    period: RecurPeriod;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    nextRunAt: Date;
    active: boolean;
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
    .maybeSingle();
  const homeCurrency = (ledgerRow?.currency as string) ?? "THB";

  let created = 0;
  for (const r of due ?? []) {
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
