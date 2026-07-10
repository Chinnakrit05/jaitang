/**
 * Tests for backup export/restore of recurring rules, focused on the
 * variable-cost corner: recurring_transactions.amount is nullable in the DB
 * (check: amount is null or amount > 0) and null means "fill the amount in
 * when the bill arrives". A backup must carry that null through an
 * export→restore round-trip, and legacy backups that encoded null as 0
 * must restore as null rather than tripping the check constraint.
 *
 * Supabase is mocked at the module boundary (same style as accounts.test.ts);
 * inserts are captured per-table so we can assert on what restore writes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  // Rows the mock returns when collectBackup reads recurring_transactions.
  // numeric columns come back from PostgREST as strings; null stays null.
  recurringRows: [] as Array<Record<string, unknown>>,
  // Everything restoreBackup inserts, keyed by table.
  inserts: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("@/lib/ledgers", () => ({
  listLedgersForUser: async () => [
    {
      id: "L1",
      name: "Household",
      icon: null,
      color: null,
      currency: "THB",
      is_personal: false,
      role: "owner" as const,
    },
  ],
}));

vi.mock("@/lib/supabase/server", () => {
  function makeChain(table: string) {
    const state = { table, inserted: false };
    const readRows = () =>
      state.table === "recurring_transactions" ? h.recurringRows : [];
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      in: () => chain,
      order: () => chain,
      insert(payload: unknown) {
        state.inserted = true;
        const rows = (Array.isArray(payload) ? payload : [payload]) as Array<
          Record<string, unknown>
        >;
        (h.inserts[state.table] ??= []).push(...rows);
        return chain;
      },
      single: async () => {
        if (state.table === "users")
          return { data: { email: "u@example.com", name: "U" }, error: null };
        return { data: { id: `new-${state.table}` }, error: null };
      },
      maybeSingle: async () => ({ data: null, error: null }),
      then(resolve: (v: { data: unknown; error: null }) => void) {
        return Promise.resolve({
          data: state.inserted ? null : readRows(),
          error: null,
        }).then(resolve);
      },
    };
    return chain;
  }
  return {
    getServerSupabase: () => ({ from: (table: string) => makeChain(table) }),
  };
});

import { collectBackup, restoreBackup, BACKUP_VERSION } from "./backup";

const variableRule = {
  id: "r1",
  category_id: null,
  kind: "expense",
  amount: null, // variable-cost rule — amount decided per bill
  note: "ค่าน้ำ",
  period: "monthly",
  day_of_month: 5,
  day_of_week: null,
  next_run_at: "2026-08-05T00:00:00Z",
  active: true,
};

const fixedYearlyRule = {
  id: "r2",
  category_id: null,
  kind: "expense",
  amount: "500.00", // PostgREST returns numeric as string
  note: "domain renewal",
  period: "yearly",
  day_of_month: null,
  day_of_week: null,
  next_run_at: "2027-01-01T00:00:00Z",
  active: true,
};

beforeEach(() => {
  h.recurringRows = [variableRule, fixedYearlyRule];
  h.inserts = {};
});

describe("collectBackup — recurring rules", () => {
  it("exports a variable-cost rule's amount as null, not 0", async () => {
    const backup = await collectBackup("user-1");
    const recurring = backup.ledgers[0].recurring;
    expect(recurring.find((r) => r.id === "r1")!.amount).toBeNull();
  });

  it("keeps real amounts numeric and preserves the yearly period", async () => {
    const backup = await collectBackup("user-1");
    const fixed = backup.ledgers[0].recurring.find((r) => r.id === "r2")!;
    expect(fixed.amount).toBe(500);
    expect(fixed.period).toBe("yearly");
  });
});

describe("restoreBackup — recurring rules", () => {
  it("round-trips a variable-cost rule: export → restore inserts SQL null", async () => {
    const backup = await collectBackup("user-1");
    await restoreBackup(backup, "user-2");

    const rows = h.inserts["recurring_transactions"];
    expect(rows).toHaveLength(2);
    const variable = rows.find((r) => r.note === "ค่าน้ำ")!;
    expect(variable.amount).toBeNull();
    const fixed = rows.find((r) => r.note === "domain renewal")!;
    expect(fixed.amount).toBe(500);
    expect(fixed.period).toBe("yearly");
  });

  it("treats a legacy backup's amount 0 as a variable rule (inserts null)", async () => {
    const legacy = {
      version: BACKUP_VERSION,
      user: { email: null, name: null },
      ledgers: [
        {
          id: "L1",
          name: "Old",
          icon: null,
          color: null,
          currency: "THB",
          is_personal: false,
          is_owned: true,
          categories: [],
          transactions: [],
          budgets: [],
          recurring: [
            {
              id: "r1",
              category_id: null,
              kind: "expense",
              amount: 0, // old exports collapsed null to 0 via Number()
              note: "ค่าไฟ",
              period: "monthly",
              day_of_month: 1,
              day_of_week: null,
              next_run_at: "2026-08-01T00:00:00Z",
              active: true,
            },
          ],
          splits: [],
        },
      ],
    };

    const summary = await restoreBackup(legacy, "user-2");
    expect(summary.recurringCreated).toBe(1);
    expect(h.inserts["recurring_transactions"][0].amount).toBeNull();
  });

  it("still rejects negative recurring amounts", async () => {
    const bad = {
      version: BACKUP_VERSION,
      user: { email: null, name: null },
      ledgers: [
        {
          id: "L1",
          name: "Bad",
          icon: null,
          color: null,
          currency: "THB",
          is_personal: false,
          is_owned: true,
          categories: [],
          transactions: [],
          budgets: [],
          recurring: [{ ...variableRule, amount: -5 }],
          splits: [],
        },
      ],
    };
    await expect(restoreBackup(bad, "user-2")).rejects.toThrow();
  });
});
