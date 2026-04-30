import { getServerSupabase } from "@/lib/supabase/server";
import type { TxKind } from "@/lib/types";

export type RecurPeriod = "daily" | "weekly" | "monthly";

export type RecurringRule = {
  id: string;
  ledger_id: string;
  user_id: string;
  category_id: string | null;
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
      "id, ledger_id, user_id, category_id, kind, amount, note, period, day_of_month, day_of_week, next_run_at, last_run_at, active, created_at, category:categories(id, name, icon, color)"
    )
    .eq("ledger_id", ledgerId)
    .order("next_run_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
    category: (Array.isArray(r.category) ? r.category[0] : r.category) ?? null,
  })) as RecurringRule[];
}

export async function createRecurring(input: {
  ledgerId: string;
  userId: string;
  categoryId: string | null;
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
      "id, user_id, category_id, kind, amount, note, period, day_of_month, day_of_week, next_run_at"
    )
    .eq("ledger_id", ledgerId)
    .eq("active", true)
    .lte("next_run_at", now.toISOString());
  if (error) throw error;

  let created = 0;
  for (const r of due ?? []) {
    // safety cap: at most 12 backfills per rule per call
    let runAt = new Date(r.next_run_at);
    let iterations = 0;
    while (runAt <= now && iterations < 12) {
      const { error: insErr } = await sb.from("transactions").insert({
        ledger_id: ledgerId,
        user_id: r.user_id,
        category_id: r.category_id,
        kind: r.kind,
        amount: r.amount,
        note: r.note ? `[ค่าประจำ] ${r.note}` : "[ค่าประจำ]",
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
