import { getServerSupabase } from "@/lib/supabase/server";
import type { Loan, LoanKind, LoanRepayment, LoanStatus } from "@/lib/types";

export type LoanWithStats = Loan & {
  /** Sum of repayments for this loan, in the loan's currency. */
  repaidAmount: number;
  /** Outstanding amount: principal - repaidAmount, never negative. */
  remaining: number;
  /** True when due_date is in the past AND status is still 'open'. */
  overdue: boolean;
  /** Number of repayment rows. */
  repaymentCount: number;
};

/**
 * List all loans in a ledger with computed remaining + overdue flag.
 *
 * The status column is updated lazily — when sum(repayments) >=
 * principal we treat the loan as settled regardless. We DO persist
 * status='settled' in `addRepayment`/`settleLoan` so filters work,
 * but the computed `remaining` is the source of truth.
 */
export async function listLoans(
  ledgerId: string,
  opts: { kind?: LoanKind; status?: LoanStatus } = {}
): Promise<LoanWithStats[]> {
  const sb = getServerSupabase();
  let q = sb
    .from("loans")
    .select(
      "id, ledger_id, user_id, kind, counterparty, principal, currency, started_at, due_date, status, settled_at, note, created_at"
    )
    .eq("ledger_id", ledgerId);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.status) q = q.eq("status", opts.status);
  q = q.order("created_at", { ascending: false });

  const { data: loans, error } = await q;
  if (error) throw error;
  if (!loans || loans.length === 0) return [];

  // Pull all repayments for these loans in one trip.
  const ids = loans.map((l) => l.id);
  const { data: repayments, error: rerr } = await sb
    .from("loan_repayments")
    .select("loan_id, amount")
    .in("loan_id", ids);
  if (rerr) throw rerr;

  const totals = new Map<string, { sum: number; count: number }>();
  for (const r of repayments ?? []) {
    const cur = totals.get(r.loan_id) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.amount);
    cur.count += 1;
    totals.set(r.loan_id, cur);
  }

  const now = Date.now();

  return loans.map((l) => {
    const t = totals.get(l.id) ?? { sum: 0, count: 0 };
    const principal = Number(l.principal);
    const remaining = Math.max(0, principal - t.sum);
    const isOpen = (l.status as LoanStatus) === "open" && remaining > 0;
    const overdue =
      isOpen && !!l.due_date && new Date(l.due_date).getTime() < now;
    return {
      ...l,
      kind: l.kind as LoanKind,
      status: l.status as LoanStatus,
      principal,
      repaidAmount: t.sum,
      remaining,
      overdue,
      repaymentCount: t.count,
    };
  });
}

export async function getLoan(
  loanId: string,
  ledgerId: string
): Promise<LoanWithStats | null> {
  // Single-row fetch — reuse the list function rather than duplicate
  // the math. Trades a couple extra ms for code simplicity.
  const all = await listLoans(ledgerId);
  return all.find((l) => l.id === loanId) ?? null;
}

export async function listRepayments(
  loanId: string
): Promise<LoanRepayment[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("loan_repayments")
    .select("id, loan_id, amount, occurred_at, note, created_at")
    .eq("loan_id", loanId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount),
  })) as LoanRepayment[];
}

export async function createLoan(input: {
  ledgerId: string;
  userId: string;
  kind: LoanKind;
  counterparty: string;
  principal: number;
  currency: string;
  startedAt: Date;
  dueDate: Date | null;
  note: string | null;
}): Promise<Loan> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("loans")
    .insert({
      ledger_id: input.ledgerId,
      user_id: input.userId,
      kind: input.kind,
      counterparty: input.counterparty,
      principal: input.principal,
      currency: input.currency,
      started_at: input.startedAt.toISOString(),
      due_date: input.dueDate ? input.dueDate.toISOString() : null,
      note: input.note,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    kind: data.kind as LoanKind,
    status: data.status as LoanStatus,
    principal: Number(data.principal),
  } as Loan;
}

export async function updateLoan(
  loanId: string,
  ledgerId: string,
  patch: Partial<{
    counterparty: string;
    principal: number;
    currency: string;
    startedAt: Date;
    dueDate: Date | null;
    note: string | null;
    kind: LoanKind;
  }>
): Promise<Loan> {
  const sb = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (patch.counterparty !== undefined) update.counterparty = patch.counterparty;
  if (patch.principal !== undefined) update.principal = patch.principal;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.startedAt !== undefined)
    update.started_at = patch.startedAt.toISOString();
  if (patch.dueDate !== undefined)
    update.due_date = patch.dueDate ? patch.dueDate.toISOString() : null;
  if (patch.note !== undefined) update.note = patch.note;

  const { data, error } = await sb
    .from("loans")
    .update(update)
    .eq("id", loanId)
    .eq("ledger_id", ledgerId)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    kind: data.kind as LoanKind,
    status: data.status as LoanStatus,
    principal: Number(data.principal),
  } as Loan;
}

export async function deleteLoan(loanId: string, ledgerId: string) {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("loans")
    .delete()
    .eq("id", loanId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}

/**
 * Add a repayment row. After insert, re-evaluates the loan status:
 * if total repayments >= principal, mark loan as settled.
 *
 * Returns the new repayment + updated status so callers don't have to
 * re-fetch.
 */
export async function addRepayment(input: {
  loanId: string;
  ledgerId: string;
  amount: number;
  occurredAt: Date;
  note: string | null;
}): Promise<{ repayment: LoanRepayment; settled: boolean }> {
  const sb = getServerSupabase();

  // Insert the repayment first.
  const { data: rep, error: rerr } = await sb
    .from("loan_repayments")
    .insert({
      loan_id: input.loanId,
      amount: input.amount,
      occurred_at: input.occurredAt.toISOString(),
      note: input.note,
    })
    .select()
    .single();
  if (rerr) throw rerr;

  // Re-check the loan total and flip status if it just crossed principal.
  const { data: loan, error: lerr } = await sb
    .from("loans")
    .select("principal, status")
    .eq("id", input.loanId)
    .eq("ledger_id", input.ledgerId)
    .single();
  if (lerr) throw lerr;

  const { data: repays } = await sb
    .from("loan_repayments")
    .select("amount")
    .eq("loan_id", input.loanId);
  const total = (repays ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );

  let settled = (loan.status as LoanStatus) === "settled";
  if (!settled && total >= Number(loan.principal)) {
    await sb
      .from("loans")
      .update({ status: "settled", settled_at: new Date().toISOString() })
      .eq("id", input.loanId);
    settled = true;
  }

  return {
    repayment: { ...rep, amount: Number(rep.amount) } as LoanRepayment,
    settled,
  };
}

export async function deleteRepayment(repaymentId: string) {
  const sb = getServerSupabase();
  // We could re-evaluate the loan status here (could un-settle a loan
  // when a repayment is removed). Keep it simple for v1: caller can
  // call settleLoan(false) manually if needed.
  const { error } = await sb
    .from("loan_repayments")
    .delete()
    .eq("id", repaymentId);
  if (error) throw error;
}

/**
 * Force the loan's status. Used to manually settle a loan that was
 * forgiven/written off before fully repaid, or to re-open a loan that
 * was prematurely marked settled.
 */
export async function setLoanStatus(
  loanId: string,
  ledgerId: string,
  status: LoanStatus
) {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("loans")
    .update({
      status,
      settled_at: status === "settled" ? new Date().toISOString() : null,
    })
    .eq("id", loanId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}
