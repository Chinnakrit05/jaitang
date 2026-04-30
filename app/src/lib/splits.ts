import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers, type Member } from "@/lib/members";

export type Split = {
  id: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  settled: boolean;
  settled_at: string | null;
};

export type Balance = {
  /** payer (creditor) */
  payerId: string;
  payerName: string | null;
  payerImage: string | null;
  /** debtor */
  debtorId: string;
  debtorName: string | null;
  debtorImage: string | null;
  /** net amount debtor owes payer (positive = debtor owes; we don't return zero/negative) */
  amount: number;
};

/**
 * Equal-split helper: split `total` among `userIds`, distributing remainder pennies
 * to the first few users so the sum exactly equals `total`.
 */
export function equalSplit(total: number, userIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  // work in cents to avoid float drift
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents - base * userIds.length;
  userIds.forEach((id, i) => {
    const cents = base + (i < remainder ? 1 : 0);
    out.set(id, cents / 100);
  });
  return out;
}

export async function listSplits(transactionId: string): Promise<Split[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("transaction_splits")
    .select("id, transaction_id, user_id, amount, settled, settled_at")
    .eq("transaction_id", transactionId);
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, amount: Number(s.amount) }));
}

export async function replaceSplits(transactionId: string, splits: Array<{ userId: string; amount: number }>) {
  const sb = getServerSupabase();
  // Delete existing, then insert fresh. Two-step instead of upsert to handle removed users.
  const { error: delErr } = await sb.from("transaction_splits").delete().eq("transaction_id", transactionId);
  if (delErr) throw delErr;
  if (splits.length === 0) return;
  const rows = splits.map((s) => ({
    transaction_id: transactionId,
    user_id: s.userId,
    amount: s.amount,
  }));
  const { error: insErr } = await sb.from("transaction_splits").insert(rows);
  if (insErr) throw insErr;
}

/**
 * Compute net balances within a ledger: who owes whom how much, after netting.
 * If A owes B 100 and B owes A 60, returns just "A owes B 40".
 */
export async function computeLedgerBalances(ledgerId: string): Promise<Balance[]> {
  const sb = getServerSupabase();

  // Fetch all unsettled splits joined with the parent transaction's payer
  const { data: rows, error } = await sb
    .from("transaction_splits")
    .select(
      "id, user_id, amount, transaction:transactions!inner(id, user_id, ledger_id)"
    )
    .eq("settled", false);
  if (error) throw error;

  // Filter to this ledger (Supabase doesn't easily support .eq on nested fields via REST without RLS)
  type Row = {
    user_id: string;
    amount: number | string;
    transaction:
      | { id: string; user_id: string; ledger_id: string }
      | { id: string; user_id: string; ledger_id: string }[];
  };

  const owedBy = new Map<string, number>(); // key: `${debtor}->${payer}` => amount

  for (const r of (rows ?? []) as Row[]) {
    const tx = Array.isArray(r.transaction) ? r.transaction[0] : r.transaction;
    if (!tx || tx.ledger_id !== ledgerId) continue;
    const payer = tx.user_id;
    const debtor = r.user_id;
    if (debtor === payer) continue; // skip self-splits if any
    const key = `${debtor}->${payer}`;
    owedBy.set(key, (owedBy.get(key) ?? 0) + Number(r.amount));
  }

  // Net out reciprocal debts
  const seen = new Set<string>();
  const netted: Array<{ debtor: string; payer: string; amount: number }> = [];
  for (const [key, amount] of owedBy.entries()) {
    if (seen.has(key)) continue;
    const [debtor, payer] = key.split("->");
    const reverseKey = `${payer}->${debtor}`;
    const reverseAmount = owedBy.get(reverseKey) ?? 0;
    seen.add(key);
    seen.add(reverseKey);
    const net = amount - reverseAmount;
    if (net > 0.005) {
      netted.push({ debtor, payer, amount: Math.round(net * 100) / 100 });
    } else if (net < -0.005) {
      netted.push({ debtor: payer, payer: debtor, amount: Math.round(-net * 100) / 100 });
    }
  }

  if (netted.length === 0) return [];

  // Resolve user info from members of this ledger
  const members = await listMembers(ledgerId);
  const memberById = new Map<string, Member>();
  for (const m of members) memberById.set(m.user_id, m);

  return netted.map((n) => {
    const debtor = memberById.get(n.debtor);
    const payer = memberById.get(n.payer);
    return {
      debtorId: n.debtor,
      debtorName: debtor?.user?.name ?? debtor?.user?.email ?? null,
      debtorImage: debtor?.user?.image ?? null,
      payerId: n.payer,
      payerName: payer?.user?.name ?? payer?.user?.email ?? null,
      payerImage: payer?.user?.image ?? null,
      amount: n.amount,
    };
  });
}

/**
 * Mark all unsettled splits between debtor → payer as settled in this ledger.
 * Used when "X paid Y back, settle up".
 */
export async function settleBetween(opts: {
  ledgerId: string;
  debtorId: string;
  payerId: string;
}): Promise<number> {
  const sb = getServerSupabase();
  // Find candidate transactions (payer paid, in this ledger, not settled splits for debtor)
  const { data: candidates, error } = await sb
    .from("transaction_splits")
    .select(
      "id, settled, user_id, transaction:transactions!inner(id, user_id, ledger_id)"
    )
    .eq("user_id", opts.debtorId)
    .eq("settled", false);
  if (error) throw error;

  type Row = {
    id: string;
    transaction:
      | { id: string; user_id: string; ledger_id: string }
      | { id: string; user_id: string; ledger_id: string }[];
  };

  const ids: string[] = [];
  for (const r of (candidates ?? []) as Row[]) {
    const tx = Array.isArray(r.transaction) ? r.transaction[0] : r.transaction;
    if (!tx) continue;
    if (tx.ledger_id !== opts.ledgerId) continue;
    if (tx.user_id !== opts.payerId) continue;
    ids.push(r.id);
  }
  if (ids.length === 0) return 0;
  const { error: updErr } = await sb
    .from("transaction_splits")
    .update({ settled: true, settled_at: new Date().toISOString() })
    .in("id", ids);
  if (updErr) throw updErr;
  return ids.length;
}
