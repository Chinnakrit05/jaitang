import { describe, expect, it } from "vitest";
import { categorySpend } from "@/lib/category-spend";

const CAT = "cat";
const FOOD = "cat-food";
const LITTER = "cat-litter";
const HOUSE = "household";

const categories = [
  { id: CAT, parent_id: null },
  { id: FOOD, parent_id: CAT },
  { id: LITTER, parent_id: CAT },
  { id: HOUSE, parent_id: null },
];

const tx = (category_id: string | null, amount: number, kind: "income" | "expense" = "expense") => ({
  kind,
  category_id,
  amount,
});

describe("categorySpend", () => {
  it("counts the category and its subcategories", () => {
    // The rule sits on แมว; the receipts land on อาหารแมว and ทรายแมว.
    const txs = [tx(CAT, 100), tx(FOOD, 450), tx(LITTER, 190)];
    expect(categorySpend(txs, categories, { kind: "expense", categoryId: CAT })).toBe(740);
  });

  it("leaves other categories out", () => {
    const txs = [tx(FOOD, 450), tx(HOUSE, 300)];
    expect(categorySpend(txs, categories, { kind: "expense", categoryId: CAT })).toBe(450);
  });

  it("only counts the rule's own kind", () => {
    const txs = [tx(CAT, 200), tx(CAT, 999, "income")];
    expect(categorySpend(txs, categories, { kind: "expense", categoryId: CAT })).toBe(200);
  });

  it("ignores uncategorized transactions", () => {
    expect(categorySpend([tx(null, 500)], categories, { kind: "expense", categoryId: CAT })).toBe(0);
  });

  it("is zero for a month with nothing in the category", () => {
    expect(categorySpend([], categories, { kind: "expense", categoryId: CAT })).toBe(0);
  });

  it("doesn't let float addition leak into the label", () => {
    const txs = [tx(CAT, 0.1), tx(CAT, 0.2)];
    expect(categorySpend(txs, categories, { kind: "expense", categoryId: CAT })).toBe(0.3);
  });
});
