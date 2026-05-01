/**
 * Tests for `aggregateMonthSummary`. Pure function, easy to drive with
 * fixture rows; no Supabase mock needed. Focused on the new
 * `byPaymentMethod` slice that powers the dashboard breakdown.
 */
import { describe, expect, it } from "vitest";
import { aggregateMonthSummary } from "./transactions";
import type { PaymentMethod, TransactionWithCategory, TxKind } from "./types";

let counter = 0;
function tx(opts: {
  kind: TxKind;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  occurredAt?: string;
  categoryId?: string | null;
  categoryName?: string | null;
}): TransactionWithCategory {
  counter++;
  return {
    id: `tx-${counter}`,
    ledger_id: "ledger-1",
    user_id: "user-1",
    category_id: opts.categoryId ?? null,
    kind: opts.kind,
    amount: opts.amount,
    note: null,
    payment_method: opts.paymentMethod ?? null,
    occurred_at: opts.occurredAt ?? "2026-05-02T03:30:00.000Z",
    created_at: "2026-05-02T03:30:00.000Z",
    updated_at: "2026-05-02T03:30:00.000Z",
    category: opts.categoryId
      ? {
          id: opts.categoryId,
          name: opts.categoryName ?? "อาหาร",
          icon: "🍜",
          color: null,
        }
      : null,
  };
}

describe("aggregateMonthSummary — byPaymentMethod", () => {
  it("returns zeroed buckets for an empty month", () => {
    const out = aggregateMonthSummary([]);
    expect(out.byPaymentMethod).toEqual({
      cash: { income: 0, expense: 0 },
      transfer: { income: 0, expense: 0 },
      unspecified: { income: 0, expense: 0 },
    });
    expect(out.income).toBe(0);
    expect(out.expense).toBe(0);
    expect(out.balance).toBe(0);
  });

  it("buckets a single cash expense correctly", () => {
    const out = aggregateMonthSummary([
      tx({ kind: "expense", amount: 100, paymentMethod: "cash" }),
    ]);
    expect(out.byPaymentMethod.cash).toEqual({ income: 0, expense: 100 });
    expect(out.byPaymentMethod.transfer).toEqual({ income: 0, expense: 0 });
    expect(out.byPaymentMethod.unspecified).toEqual({ income: 0, expense: 0 });
  });

  it("separates income vs expense within the same bucket", () => {
    const out = aggregateMonthSummary([
      tx({ kind: "income", amount: 30000, paymentMethod: "transfer" }),
      tx({ kind: "expense", amount: 4000, paymentMethod: "transfer" }),
      tx({ kind: "expense", amount: 1500, paymentMethod: "transfer" }),
    ]);
    expect(out.byPaymentMethod.transfer).toEqual({
      income: 30000,
      expense: 5500,
    });
  });

  it("routes payment_method=null rows to 'unspecified' (legacy data)", () => {
    const out = aggregateMonthSummary([
      tx({ kind: "expense", amount: 50, paymentMethod: null }),
      tx({ kind: "expense", amount: 25 }), // omitted = null
    ]);
    expect(out.byPaymentMethod.unspecified.expense).toBe(75);
    expect(out.byPaymentMethod.cash.expense).toBe(0);
    expect(out.byPaymentMethod.transfer.expense).toBe(0);
  });

  it("buckets sum to the overall totals (invariant for the dashboard)", () => {
    const txs = [
      tx({ kind: "expense", amount: 65, paymentMethod: "cash" }),
      tx({ kind: "expense", amount: 4000, paymentMethod: "transfer" }),
      tx({ kind: "income", amount: 30000, paymentMethod: "transfer" }),
      tx({ kind: "expense", amount: 250, paymentMethod: null }),
      tx({ kind: "income", amount: 500, paymentMethod: "cash" }),
    ];
    const out = aggregateMonthSummary(txs);

    const summedIncome =
      out.byPaymentMethod.cash.income +
      out.byPaymentMethod.transfer.income +
      out.byPaymentMethod.unspecified.income;
    const summedExpense =
      out.byPaymentMethod.cash.expense +
      out.byPaymentMethod.transfer.expense +
      out.byPaymentMethod.unspecified.expense;

    expect(summedIncome).toBe(out.income);
    expect(summedExpense).toBe(out.expense);
    expect(out.balance).toBe(out.income - out.expense);
  });

  it("buckets day keys in BUSINESS_TZ (Asia/Bangkok), not UTC", () => {
    // 20:46 UTC May 1 = 03:46 Bangkok May 2. The aggregator must put this
    // under 2026-05-02, otherwise late-night Bangkok rows leak into the
    // previous day on the daily-trend chart.
    const out = aggregateMonthSummary([
      tx({
        kind: "expense",
        amount: 274,
        paymentMethod: "cash",
        occurredAt: "2026-05-01T20:46:00Z",
      }),
      tx({
        kind: "expense",
        amount: 95,
        paymentMethod: "cash",
        occurredAt: "2026-05-01T07:59:00Z", // 14:59 Bangkok same day
      }),
    ]);
    const days = out.byDay.map((d) => d.day);
    expect(days).toContain("2026-05-02");
    expect(days).toContain("2026-05-01");

    const may1 = out.byDay.find((d) => d.day === "2026-05-01");
    const may2 = out.byDay.find((d) => d.day === "2026-05-02");
    expect(may1?.expense).toBe(95);
    expect(may2?.expense).toBe(274);
  });

  it("does not let payment_method buckets affect byCategory math", () => {
    // Same category, two different payment methods → still one byCategory row
    const out = aggregateMonthSummary([
      tx({
        kind: "expense",
        amount: 100,
        paymentMethod: "cash",
        categoryId: "c1",
        categoryName: "อาหาร",
      }),
      tx({
        kind: "expense",
        amount: 200,
        paymentMethod: "transfer",
        categoryId: "c1",
        categoryName: "อาหาร",
      }),
    ]);
    const food = out.byCategory.find((c) => c.category_id === "c1");
    expect(food?.total).toBe(300);
    expect(out.byPaymentMethod.cash.expense).toBe(100);
    expect(out.byPaymentMethod.transfer.expense).toBe(200);
  });
});
