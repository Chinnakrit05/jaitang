import { describe, expect, it } from "vitest";
import { keepConfidentMoves, type RawProposal } from "@/lib/recategorize-ai";
import type { Category, TransactionWithCategory } from "@/lib/types";

const FOOD = "11111111-1111-4111-8111-111111111111";
const CAFE = "22222222-2222-4222-8222-222222222222";
const SALARY = "33333333-3333-4333-8333-333333333333";

const categories: Category[] = [
  { id: FOOD, ledger_id: "l", name: "อาหาร", icon: "🍜", color: null, kind: "expense", sort_order: 1, parent_id: null },
  { id: CAFE, ledger_id: "l", name: "คาเฟ่", icon: "☕", color: null, kind: "expense", sort_order: 2, parent_id: FOOD },
  { id: SALARY, ledger_id: "l", name: "เงินเดือน", icon: "💼", color: null, kind: "income", sort_order: 3, parent_id: null },
];

const baseTx = {
  ledger_id: "l",
  user_id: "u",
  trip_id: null,
  account_id: null,
  payment_method: null,
  fx_currency: null,
  fx_amount: null,
  fx_rate: null,
  occurred_at: "2026-08-10T00:00:00Z",
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
  deleted_at: null,
  recurring_id: null,
  skipped: false,
  trip: null,
} as const;

function tx(
  id: string,
  kind: "income" | "expense",
  categoryId: string | null
): TransactionWithCategory {
  const cat = categories.find((c) => c.id === categoryId);
  return {
    ...baseTx,
    id,
    kind,
    amount: 100,
    note: "n",
    category_id: categoryId,
    category: cat
      ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }
      : null,
  };
}

const raw = (
  txId: string,
  categoryId: string | null,
  confidence: RawProposal["confidence"]
): RawProposal => ({ txId, categoryId, confidence });

describe("keepConfidentMoves", () => {
  it("keeps a confident move to a different category", () => {
    const out = keepConfidentMoves(
      [raw("t1", CAFE, "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([
      { txId: "t1", categoryId: CAFE, confidence: "high" },
    ]);
  });

  it("leaves the transaction alone when the model is not confident", () => {
    // The rule the feature was asked for: unsure means keep what it has.
    const out = keepConfidentMoves(
      [raw("t1", CAFE, "low")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });

  it("leaves it alone when the model picked nothing", () => {
    const out = keepConfidentMoves(
      [raw("t1", null, "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });

  it("drops a category id that is not in this ledger", () => {
    const out = keepConfidentMoves(
      [raw("t1", "99999999-9999-4999-8999-999999999999", "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });

  it("refuses to file an expense under an income category", () => {
    const out = keepConfidentMoves(
      [raw("t1", SALARY, "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });

  it("is not a change when the model agrees with the current category", () => {
    const out = keepConfidentMoves(
      [raw("t1", FOOD, "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });

  it("moves an uncategorized transaction", () => {
    const out = keepConfidentMoves(
      [raw("t1", FOOD, "medium")],
      [tx("t1", "expense", null)],
      categories
    );
    expect(out).toHaveLength(1);
    expect(out[0].categoryId).toBe(FOOD);
  });

  it("ignores a second opinion about the same transaction", () => {
    const out = keepConfidentMoves(
      [raw("t1", CAFE, "high"), raw("t1", FOOD, "high")],
      [tx("t1", "expense", null)],
      categories
    );
    expect(out).toHaveLength(1);
    expect(out[0].categoryId).toBe(CAFE);
  });

  it("ignores a proposal about a transaction that was not sent", () => {
    const out = keepConfidentMoves(
      [raw("ghost", CAFE, "high")],
      [tx("t1", "expense", FOOD)],
      categories
    );
    expect(out).toEqual([]);
  });
});
