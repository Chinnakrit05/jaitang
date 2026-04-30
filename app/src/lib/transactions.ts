import { getServerSupabase } from "@/lib/supabase/server";
import type {
  MonthSummary,
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
      "id, ledger_id, user_id, category_id, kind, amount, note, occurred_at, created_at, updated_at, category:categories(id, name, icon, color), user:users(id, name, email, image)"
    )
    .eq("ledger_id", opts.ledgerId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lt("occurred_at", opts.to);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (typeof opts.limit === "number") q = q.limit(opts.limit);
  if (typeof opts.offset === "number" && opts.limit)
    q = q.range(opts.offset, opts.offset + opts.limit - 1);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const cat = (Array.isArray(row.category) ? row.category[0] : row.category) ?? null;
    const usr = (Array.isArray(row.user) ? row.user[0] : row.user) ?? null;
    return {
      id: row.id,
      ledger_id: row.ledger_id,
      user_id: row.user_id,
      category_id: row.category_id,
      kind: row.kind as TxKind,
      amount: Number(row.amount),
      note: row.note,
      occurred_at: row.occurred_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: cat,
      user: usr,
    };
  });
}

export type CreateTxInput = {
  ledgerId: string;
  userId: string;
  categoryId: string | null;
  kind: TxKind;
  amount: number;
  note?: string;
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
      kind: input.kind,
      amount: input.amount,
      note: input.note ?? null,
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
    kind: TxKind;
    amount: number;
    note: string | null;
    occurredAt: string;
  }>
) {
  const sb = getServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.note !== undefined) patch.note = input.note;
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
 * Aggregate a single ledger's month: totals + by category + by day.
 * Computed in JS for MVP simplicity; small n. Move to SQL view later.
 */
export async function getMonthSummary(
  ledgerId: string,
  year: number,
  month: number // 1-12
): Promise<MonthSummary> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const txs = await listTransactions({
    ledgerId,
    from: start.toISOString(),
    to: end.toISOString(),
    limit: 5000,
  });

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

    const day = tx.occurred_at.slice(0, 10);
    const dayEntry = byDayMap.get(day) ?? { income: 0, expense: 0 };
    if (tx.kind === "income") dayEntry.income += tx.amount;
    else dayEntry.expense += tx.amount;
    byDayMap.set(day, dayEntry);
  }

  return {
    income,
    expense,
    balance: income - expense,
    byCategory: Array.from(byCatMap.values()).sort((a, b) => b.total - a.total),
    byDay: Array.from(byDayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}
