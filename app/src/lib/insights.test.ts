/**
 * Tests for the MoM-compare math. We mock `getMonthSummary` at the module
 * boundary so the focus is the diffing logic — not the SQL fetch.
 *
 * Vitest hoists `vi.mock(...)` to the top of the file, so all fixtures
 * the factory reads have to live inside the factory itself (no closure
 * over module-level constants).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("./transactions", () => {
  const summary = (opts: {
    income?: number;
    expense?: number;
    byCategory?: Array<{
      category_id: string;
      name: string;
      icon: string | null;
      color: string | null;
      kind: "income" | "expense";
      total: number;
    }>;
  }) => ({
    income: opts.income ?? 0,
    expense: opts.expense ?? 0,
    balance: (opts.income ?? 0) - (opts.expense ?? 0),
    byCategory: opts.byCategory ?? [],
    byDay: [],
    byPaymentMethod: {
      cash: { income: 0, expense: 0 },
      transfer: { income: 0, expense: 0 },
      unspecified: { income: 0, expense: 0 },
    },
  });

  const thisMonth = summary({
    income: 30000,
    expense: 15000,
    byCategory: [
      { category_id: "food", name: "อาหาร", icon: "🍜", color: null, kind: "expense", total: 6000 },
      { category_id: "trip", name: "ทริปทะเล", icon: "🏖️", color: null, kind: "expense", total: 4000 },
      { category_id: "rent", name: "ค่าเช่า", icon: "🏠", color: null, kind: "expense", total: 5000 },
    ],
  });
  const prevMonth = summary({
    income: 30000,
    expense: 11000,
    byCategory: [
      { category_id: "food", name: "อาหาร", icon: "🍜", color: null, kind: "expense", total: 4500 },
      { category_id: "rent", name: "ค่าเช่า", icon: "🏠", color: null, kind: "expense", total: 5000 },
      { category_id: "ent", name: "บันเทิง", icon: "🎮", color: null, kind: "expense", total: 1500 },
    ],
  });

  return {
    // Order: first call → this month, second → prev month
    getMonthSummary: vi
      .fn()
      .mockResolvedValueOnce(thisMonth)
      .mockResolvedValueOnce(prevMonth),
  };
});

import { compareMonths } from "./insights";

describe("compareMonths", () => {
  it("computes top movers correctly", async () => {
    const c = await compareMonths("ledger-1", 2026, 5);

    // Totals
    expect(c.totals.expenseDelta).toBe(4000); // 15000 - 11000
    expect(Math.round(c.totals.expenseDeltaPct ?? 0)).toBe(36);
    expect(c.totals.incomeDelta).toBe(0);

    // Up: trip (4000 new) is the biggest, then food (1500). Steady rent
    // is excluded (delta = 0).
    expect(c.expenseUp.map((d) => d.id)).toEqual([
      "expense:trip",
      "expense:food",
    ]);
    expect(c.expenseUp[0].prevAmount).toBe(0);
    expect(c.expenseUp[0].deltaPct).toBeNull();

    // Down: บันเทิง dropped from 1500 → 0
    expect(c.expenseDown.map((d) => d.id)).toEqual(["expense:ent"]);
    expect(c.expenseDown[0].delta).toBe(-1500);
  });
});
