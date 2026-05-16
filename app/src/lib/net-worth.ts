import { getServerSupabase } from "@/lib/supabase/server";
import { fetchFxRate } from "@/lib/fx";
import { businessTzMidnightUtc } from "@/lib/business-tz";

export type NetWorthPoint = {
  /** YYYY-MM-DD in business TZ — the END of the bucket. */
  date: string;
  /** Net worth in HOME currency at this point in time. */
  netWorth: number;
  /** Per-account balances at this point, in account-native currency. */
  perAccount: Record<string, number>;
};

/**
 * Build a monthly time series of total net worth across all accounts.
 *
 * Algorithm:
 *   1. Pull all accounts + every tx + every transfer once (sorted asc).
 *   2. Walk forward through tx + transfers, maintaining a per-account
 *      running balance in account-native currency.
 *   3. At each month-end sample point, snapshot the running totals,
 *      then convert foreign-currency balances to home using TODAY'S FX
 *      rate (free APIs don't expose historical rates; for personal
 *      finance trend tracking that's acceptable — the chart shows
 *      "what your accounts are worth NOW projected through history").
 *
 * Inputs:
 *   - `monthsBack`: how many months of history to render (default 12).
 *
 * Returns oldest-first so the chart can plot directly.
 */
export async function buildNetWorthHistory(
  ledgerId: string,
  homeCurrency: string,
  opts: { monthsBack?: number } = {}
): Promise<NetWorthPoint[]> {
  const monthsBack = opts.monthsBack ?? 12;
  const sb = getServerSupabase();

  // Fetch in parallel.
  const [accountsRes, txRes, transfersRes] = await Promise.all([
    sb
      .from("accounts")
      .select("id, currency, initial_balance, archived")
      .eq("ledger_id", ledgerId),
    sb
      .from("transactions")
      .select("account_id, kind, amount, fx_currency, fx_amount, occurred_at")
      .eq("ledger_id", ledgerId)
      .is("deleted_at", null)
      .not("account_id", "is", null)
      .order("occurred_at", { ascending: true }),
    sb
      .from("transfers")
      .select(
        "from_account_id, to_account_id, from_amount, to_amount, occurred_at"
      )
      .eq("ledger_id", ledgerId)
      .order("occurred_at", { ascending: true }),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (txRes.error) throw txRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const accounts = accountsRes.data ?? [];
  if (accounts.length === 0) return [];

  // Per-account running balance (in account-native currency).
  const balances = new Map<string, number>();
  const accCurrency = new Map<string, string>();
  for (const a of accounts) {
    balances.set(a.id, Number(a.initial_balance));
    accCurrency.set(a.id, (a.currency as string) ?? homeCurrency);
  }

  // FX rates for foreign currencies → home. Fetched once up-front, used
  // for every sample point (no historical rate lookup).
  const foreignCurrencies = new Set<string>();
  for (const cur of accCurrency.values()) {
    if (cur !== homeCurrency) foreignCurrencies.add(cur);
  }
  const fxRates = new Map<string, number>();
  fxRates.set(homeCurrency, 1);
  for (const cur of foreignCurrencies) {
    try {
      const rate = await fetchFxRate(cur, homeCurrency);
      fxRates.set(cur, rate);
    } catch {
      // FX unavailable — fall back to 1:1 so the chart still plots
      // (slightly off but won't crash). Better than skipping the
      // account entirely.
      fxRates.set(cur, 1);
    }
  }

  // Build sample points: month-ends going back `monthsBack` months,
  // ending at today (clamped to month-end of current month).
  const now = new Date();
  const samplePoints: { date: Date; iso: string }[] = [];
  for (let i = monthsBack; i >= 0; i--) {
    // For month i back from now, sample at end-of-that-month (= start
    // of next month minus 1ms is overkill — just use start of next
    // month as the "as-of" cutoff).
    const tzNow = new Date(now.getTime() + 7 * 3600_000);
    const year = tzNow.getUTCFullYear();
    const month = tzNow.getUTCMonth();
    // Sample at end-of-month: start of (month - i + 1)
    const sampleEnd = businessTzMidnightUtc(year, month - i + 1, 1);
    samplePoints.push({
      date: sampleEnd,
      iso: sampleEnd.toISOString(),
    });
  }

  // Merge tx + transfers into a single time-ordered event list.
  type Event =
    | {
        kind: "tx";
        accountId: string;
        nativeAmount: number;
        delta: 1 | -1;
        at: number;
      }
    | { kind: "transfer"; accountId: string; nativeAmount: number; at: number };

  const events: Event[] = [];

  for (const tx of txRes.data ?? []) {
    if (!tx.account_id) continue;
    const acur = accCurrency.get(tx.account_id);
    if (!acur) continue;
    // Same logic as listAccounts: use fx_amount when account currency
    // matches; otherwise use amount (home) when no fx_currency. Skip
    // when there's a mismatch — the row doesn't move the balance.
    const native =
      tx.fx_currency === acur && tx.fx_amount !== null
        ? Number(tx.fx_amount)
        : !tx.fx_currency
        ? Number(tx.amount)
        : null;
    if (native === null) continue;
    events.push({
      kind: "tx",
      accountId: tx.account_id,
      nativeAmount: native,
      delta: tx.kind === "income" ? 1 : -1,
      at: new Date(tx.occurred_at).getTime(),
    });
  }

  for (const tr of transfersRes.data ?? []) {
    if (tr.from_account_id) {
      events.push({
        kind: "transfer",
        accountId: tr.from_account_id,
        // Outflow: subtract from "from" side (negative native).
        nativeAmount: -Number(tr.from_amount),
        at: new Date(tr.occurred_at).getTime(),
      });
    }
    if (tr.to_account_id) {
      events.push({
        kind: "transfer",
        accountId: tr.to_account_id,
        nativeAmount: Number(tr.to_amount),
        at: new Date(tr.occurred_at).getTime(),
      });
    }
  }
  events.sort((a, b) => a.at - b.at);

  // Walk events forward, snapshot at each sample point.
  const points: NetWorthPoint[] = [];
  let eventIdx = 0;
  for (const sp of samplePoints) {
    const cutoff = sp.date.getTime();
    while (eventIdx < events.length && events[eventIdx].at < cutoff) {
      const ev = events[eventIdx];
      const cur = balances.get(ev.accountId);
      if (cur !== undefined) {
        if (ev.kind === "tx") {
          balances.set(ev.accountId, cur + ev.nativeAmount * ev.delta);
        } else {
          balances.set(ev.accountId, cur + ev.nativeAmount);
        }
      }
      eventIdx++;
    }

    // Snapshot: per-account balances + total in home currency.
    let total = 0;
    const perAccount: Record<string, number> = {};
    for (const [accId, bal] of balances.entries()) {
      perAccount[accId] = bal;
      const cur = accCurrency.get(accId) ?? homeCurrency;
      const rate = fxRates.get(cur) ?? 1;
      total += bal * rate;
    }
    points.push({
      date: sp.iso.slice(0, 10),
      netWorth: Math.round(total * 100) / 100,
      perAccount,
    });
  }

  return points;
}
