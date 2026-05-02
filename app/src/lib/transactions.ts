import { getServerSupabase } from "@/lib/supabase/server";
import { dayKeyInTz } from "@/lib/utils";
import {
  BUSINESS_TZ,
  businessTzMidnightUtc,
} from "@/lib/business-tz";
import type {
  MonthSummary,
  PaymentMethod,
  Transaction,
  TransactionWithCategory,
  TxKind,
} from "@/lib/types";

export type ListOptions = {
  ledgerId: string;
  from?: string; // ISO date
  to?: string; // ISO date
  kind?: TxKind;
  categoryId?: string;
  /** Filter to rows tagged with this trip. Pass `null` for "no trip". */
  tripId?: string | null;
  /** Free-text search against the note column (case-insensitive substring). */
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listTransactions(
  opts: ListOptions
): Promise<TransactionWithCategory[]> {
  const sb = getServerSupabase();
  let q = sb
    .from("transactions")
    .select(
      "id, ledger_id, user_id, category_id, trip_id, kind, amount, note, payment_method, occurred_at, created_at, updated_at, category:categories(id, name, icon, color), trip:trips(id, name, icon, color), user:users(id, name, email, image)"
    )
    .eq("ledger_id", opts.ledgerId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lt("occurred_at", opts.to);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.tripId === null) q = q.is("trip_id", null);
  else if (typeof opts.tripId === "string") q = q.eq("trip_id", opts.tripId);
  // Note search: PostgREST `ilike` does case-insensitive substring. We don't
  // try to search joined category names — those are already filterable via
  // the category dropdown and joining-with-or has surprising behaviour
  // around row visibility.
  if (opts.search && opts.search.trim()) {
    q = q.ilike("note", `%${opts.search.trim()}%`);
  }
  if (typeof opts.limit === "number") q = q.limit(opts.limit);
  if (typeof opts.offset === "number" && opts.limit)
    q = q.range(opts.offset, opts.offset + opts.limit - 1);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const cat = (Array.isArray(row.category) ? row.category[0] : row.category) ?? null;
    const trp = (Array.isArray(row.trip) ? row.trip[0] : row.trip) ?? null;
    const usr = (Array.isArray(row.user) ? row.user[0] : row.user) ?? null;
    return {
      id: row.id,
      ledger_id: row.ledger_id,
      user_id: row.user_id,
      category_id: row.category_id,
      trip_id: row.trip_id ?? null,
      kind: row.kind as TxKind,
      amount: Number(row.amount),
      note: row.note,
      payment_method: (row.payment_method as PaymentMethod | null) ?? null,
      occurred_at: row.occurred_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: cat,
      trip: trp,
      user: usr,
    };
  });
}

export type CreateTxInput = {
  ledgerId: string;
  userId: string;
  categoryId: string | null;
  /** Optional trip association — null = no trip */
  tripId?: string | null;
  kind: TxKind;
  amount: number;
  note?: string;
  paymentMethod?: PaymentMethod | null;
  occurredAt: string;
};

export async function createTransaction(input: CreateTxInput) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("transactions")
    .insert({
      ledger_id: input.ledgerId,
      user_id: input.userId,
      category_id: input.categoryId,
      trip_id: input.tripId ?? null,
      kind: input.kind,
      amount: input.amount,
      note: input.note ?? null,
      payment_method: input.paymentMethod ?? null,
      occurred_at: input.occurredAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(
  id: string,
  input: Partial<{
    categoryId: string | null;
    tripId: string | null;
    kind: TxKind;
    amount: number;
    note: string | null;
    paymentMethod: PaymentMethod | null;
    occurredAt: string;
  }>
) {
  const sb = getServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.tripId !== undefined) patch.trip_id = input.tripId;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.note !== undefined) patch.note = input.note;
  if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;
  if (input.occurredAt !== undefined) patch.occurred_at = input.occurredAt;

  const { data, error } = await sb
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const sb = getServerSupabase();
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Delete every transaction in a ledger. Splits are removed automatically by
 * the `transaction_splits.transaction_id` ON DELETE CASCADE foreign key.
 * Caller is responsible for authorizing — typically owner-only.
 *
 * Returns the number of transactions deleted (best-effort; supabase doesn't
 * always report a row count, so this falls back to 0).
 */
export async function wipeLedgerTransactions(ledgerId: string): Promise<number> {
  const sb = getServerSupabase();
  // First count, so we can report it back to the UI.
  const { count } = await sb
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("ledger_id", ledgerId);

  const { error } = await sb
    .from("transactions")
    .delete()
    .eq("ledger_id", ledgerId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Sum income + expense in [from, to). Lightweight — just totals,
 * no per-category breakdown. Used by the navbar period stat.
 */
export async function sumPeriod(
  ledgerId: string,
  from: Date,
  to: Date
): Promise<{ income: number; expense: number }> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("transactions")
    .select("kind, amount")
    .eq("ledger_id", ledgerId)
    .gte("occurred_at", from.toISOString())
    .lt("occurred_at", to.toISOString())
    .limit(20000);
  if (error) throw error;
  let income = 0;
  let expense = 0;
  for (const r of data ?? []) {
    if (r.kind === "income") income += Number(r.amount);
    else expense += Number(r.amount);
  }
  return { income, expense };
}

/**
 * Pure aggregation. Extracted from `getMonthSummary` so unit tests can
 * exercise it without a Supabase round trip. Whatever fetch the caller
 * runs, hand the row list here and you get the dashboard's shape.
 */
export function aggregateMonthSummary(
  txs: TransactionWithCategory[]
): MonthSummary {
  let income = 0;
  let expense = 0;
  const byCatMap = new Map<
    string,
    {
      category_id: string | null;
      name: string;
      icon: string | null;
      color: string | null;
      kind: TxKind;
      total: number;
    }
  >();
  const byDayMap = new Map<string, { income: number; expense: number }>();
  const byPaymentMethod = {
    cash: { income: 0, expense: 0 },
    transfer: { income: 0, expense: 0 },
    unspecified: { income: 0, expense: 0 },
  };

  for (const tx of txs) {
    if (tx.kind === "income") income += tx.amount;
    else expense += tx.amount;

    const catKey = `${tx.kind}:${tx.category_id ?? "none"}`;
    const existing = byCatMap.get(catKey);
    if (existing) {
      existing.total += tx.amount;
    } else {
      byCatMap.set(catKey, {
        category_id: tx.category_id,
        name: tx.category?.name ?? "ไม่ระบุ",
        icon: tx.category?.icon ?? null,
        color: tx.category?.color ?? null,
        kind: tx.kind,
        total: tx.amount,
      });
    }

    // Bucket by day in BUSINESS_TZ, not UTC. A Bangkok row at 02:00 local
    // is 19:00 UTC the previous day — bucketing on the UTC date would
    // attribute it to yesterday on the daily-trend chart.
    const day = dayKeyInTz(tx.occurred_at, BUSINESS_TZ);
    const dayEntry = byDayMap.get(day) ?? { income: 0, expense: 0 };
    if (tx.kind === "income") dayEntry.income += tx.amount;
    else dayEntry.expense += tx.amount;
    byDayMap.set(day, dayEntry);

    // Bucket by payment method. NULL → "unspecified" so the dashboard can
    // show users how much of their history is missing this tag and nudge
    // them to backfill.
    const bucket =
      tx.payment_method === "cash"
        ? byPaymentMethod.cash
        : tx.payment_method === "transfer"
        ? byPaymentMethod.transfer
        : byPaymentMethod.unspecified;
    if (tx.kind === "income") bucket.income += tx.amount;
    else bucket.expense += tx.amount;
  }

  return {
    income,
    expense,
    balance: income - expense,
    byCategory: Array.from(byCatMap.values()).sort((a, b) => b.total - a.total),
    byDay: Array.from(byDayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byPaymentMethod,
  };
}

/**
 * Aggregate a single ledger's month: totals + by category + by day.
 * Computed in JS for MVP simplicity; small n. Move to SQL view later.
 *
 * The month window is [BUSINESS_TZ-midnight of month start, BUSINESS_TZ-
 * midnight of month-after start). With UTC bounds we'd over-count the last
 * 7 hours of the previous month and under-count the last 7 hours of this
 * month, both visible to the user as "why is May 31 23:00 missing from
 * my May report?"
 */
export async function getMonthSummary(
  ledgerId: string,
  year: number,
  month: number // 1-12
): Promise<MonthSummary> {
  // BUSINESS_TZ midnight on the 1st of the month, in UTC instant terms.
  const start = businessTzMidnightUtc(year, month - 1, 1);
  const end = businessTzMidnightUtc(year, month, 1);

  const txs = await listTransactions({
    ledgerId,
    from: start.toISOString(),
    to: end.toISOString(),
    limit: 5000,
  });

  return aggregateMonthSummary(txs);
}
