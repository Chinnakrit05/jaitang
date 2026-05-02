/**
 * Tests for the account balance computation. Mocks Supabase at the
 * module boundary to focus on the JS that turns
 * (initial + tx + transfer) rows into per-account balances + counts.
 *
 * Covers the tricky corners:
 *   - same-currency tx in fx_amount path AND home-currency path
 *   - mismatched-currency tx skipped from balance
 *   - transfers add/subtract on the right account
 *   - includeArchived filter
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => {
  const accountRows = [
    {
      id: "a1",
      ledger_id: "L",
      name: "Cash",
      type: "cash",
      icon: "💵",
      color: "#10b981",
      initial_balance: "1000",
      currency: null, // inherits home (THB)
      archived: false,
      created_at: "2026-04-01T00:00:00Z",
    },
    {
      id: "a2",
      ledger_id: "L",
      name: "JPY wallet",
      type: "e_wallet",
      icon: "📱",
      color: "#3b82f6",
      initial_balance: "5000",
      currency: "JPY",
      archived: false,
      created_at: "2026-04-01T00:00:00Z",
    },
    {
      id: "a3",
      ledger_id: "L",
      name: "Old card",
      type: "credit_card",
      icon: "💳",
      color: "#ef4444",
      initial_balance: "0",
      currency: null,
      archived: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const txRows = [
    // a1 (THB) — home-currency expense, +100 income; balance becomes 1000 + 100 - 50 = 1050
    {
      account_id: "a1",
      kind: "income",
      amount: "100",
      fx_currency: null,
      fx_amount: null,
    },
    {
      account_id: "a1",
      kind: "expense",
      amount: "50",
      fx_currency: null,
      fx_amount: null,
    },
    // a2 (JPY) — JPY-native expense via fx fields; balance becomes 5000 - 200
    {
      account_id: "a2",
      kind: "expense",
      amount: "60", // home-currency value (THB ≈ 200 JPY * 0.3)
      fx_currency: "JPY",
      fx_amount: "200",
    },
    // a2 (JPY) — currency mismatch (USD tx tagged here) — should be SKIPPED
    {
      account_id: "a2",
      kind: "expense",
      amount: "100",
      fx_currency: "USD",
      fx_amount: "3",
    },
  ];

  const transferRows = [
    // 500 THB out of a1, into a2 as 2000 JPY
    {
      from_account_id: "a1",
      to_account_id: "a2",
      from_amount: "500",
      to_amount: "2000",
    },
  ];

  const ledgerRows = [{ id: "L", currency: "THB" }];

  // Each .from() returns a FRESH chain — supabase-js queries are
  // independent, but they're spawned concurrently in listAccounts via
  // Promise.all, so a shared mutable builder would let one query's
  // _table clobber another's mid-flight.
  function makeChain(table: string) {
    const state = {
      table,
      includeArchived: true,
      idsFilter: null as string[] | null,
      eqFilters: [] as Array<{ col: string; val: unknown }>,
    };
    const chain: {
      select: () => typeof chain;
      eq: (c: string, v: unknown) => typeof chain;
      in: (c: string, ids: string[]) => typeof chain;
      or: () => typeof chain;
      order: () => typeof chain;
      maybeSingle: () => Promise<{ data: unknown; error: null }>;
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => Promise<void>;
    } = {
      select: () => chain,
      eq(col, val) {
        if (col === "archived" && val === false) state.includeArchived = false;
        state.eqFilters.push({ col, val });
        return chain;
      },
      in(col, ids) {
        if (col === "account_id") state.idsFilter = ids;
        return chain;
      },
      or: () => chain,
      order: () => chain,
      maybeSingle() {
        if (state.table === "ledgers") {
          const id = state.eqFilters.find((f) => f.col === "id")?.val;
          const row = ledgerRows.find((l) => l.id === id) ?? null;
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve) {
        if (state.table === "accounts") {
          const rows = state.includeArchived
            ? accountRows
            : accountRows.filter((a) => !a.archived);
          resolve({ data: rows, error: null });
        } else if (state.table === "transactions") {
          const rows = state.idsFilter
            ? txRows.filter((r) => state.idsFilter!.includes(r.account_id))
            : txRows;
          resolve({ data: rows, error: null });
        } else if (state.table === "transfers") {
          resolve({ data: transferRows, error: null });
        } else {
          resolve({ data: [], error: null });
        }
        return Promise.resolve();
      },
    };
    return chain;
  }

  return {
    getServerSupabase: () => ({ from: (table: string) => makeChain(table) }),
  };
});

import { listAccounts } from "./accounts";

describe("listAccounts — balance computation", () => {
  it("includes archived when asked, excludes by default", async () => {
    const all = await listAccounts("L", { includeArchived: true });
    expect(all).toHaveLength(3);

    const active = await listAccounts("L");
    expect(active).toHaveLength(2);
    expect(active.every((a) => !a.archived)).toBe(true);
  });

  it("balance = initial + income - expense + transferIn - transferOut (home currency)", async () => {
    const accounts = await listAccounts("L", { includeArchived: true });
    const cash = accounts.find((a) => a.id === "a1")!;
    // 1000 (initial) + 100 (income) - 50 (expense) - 500 (transfer out) = 550
    expect(cash.balance).toBe(550);
    expect(cash.txCount).toBe(2);
    expect(cash.transferCount).toBe(1);
  });

  it("uses fx_amount for currency-matching FX rows; skips mismatched currency", async () => {
    const accounts = await listAccounts("L", { includeArchived: true });
    const jpy = accounts.find((a) => a.id === "a2")!;
    // 5000 (initial) - 200 (JPY expense) + 2000 (transfer in) = 6800
    // The USD-tagged row is skipped because the account is JPY.
    expect(jpy.balance).toBe(6800);
    // tx count counts BOTH (USD and JPY rows are tx rows tagged here even
    // though the USD one doesn't move the balance) — matches the lib's
    // counter-bumps-before-skip behavior.
    expect(jpy.txCount).toBe(2);
    expect(jpy.transferCount).toBe(1);
  });

  it("archived accounts compute balances normally", async () => {
    const accounts = await listAccounts("L", { includeArchived: true });
    const old = accounts.find((a) => a.id === "a3")!;
    expect(old.archived).toBe(true);
    expect(old.balance).toBe(0); // no tx, no transfers, initial 0
  });
});
