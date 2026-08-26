import { describe, expect, it } from "vitest";
import { groupItemsByCategory, type ReceiptLineItem } from "@/lib/receipt-items";

const FOOD = "11111111-1111-4111-8111-111111111111";
const PET = "22222222-2222-4222-8222-222222222222";
const HOME = "33333333-3333-4333-8333-333333333333";

const item = (
  name: string,
  amount: number,
  categoryId: string | null
): ReceiptLineItem => ({ name, amount, categoryId });

describe("groupItemsByCategory", () => {
  it("collapses items that share a category into one entry", () => {
    const groups = groupItemsByCategory([
      item("อาหารแมว", 1087, PET),
      item("ทรายแมว", 1040, PET),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ categoryId: PET, amount: 2127 });
    expect(groups[0].items.map((i) => i.name)).toEqual([
      "อาหารแมว",
      "ทรายแมว",
    ]);
  });

  it("keeps one entry per category for a mixed receipt", () => {
    const groups = groupItemsByCategory([
      item("นม", 59, FOOD),
      item("อาหารแมว", 1087, PET),
      item("น้ำยาล้างจาน", 89, HOME),
      item("ทรายแมว", 1040, PET),
    ]);
    expect(groups.map((g) => g.categoryId)).toEqual([FOOD, PET, HOME]);
    expect(groups.map((g) => g.amount)).toEqual([59, 2127, 89]);
  });

  it("orders groups by where they first appear on the receipt", () => {
    // Reading order matters: the modal is meant to be checkable against
    // the paper without hunting.
    const groups = groupItemsByCategory([
      item("น้ำยาล้างจาน", 89, HOME),
      item("นม", 59, FOOD),
    ]);
    expect(groups.map((g) => g.categoryId)).toEqual([HOME, FOOD]);
  });

  it("pools uncategorized items into their own group", () => {
    const groups = groupItemsByCategory([
      item("นม", 59, FOOD),
      item("???", 20, null),
      item("ของแถม", 15, null),
    ]);
    expect(groups).toHaveLength(2);
    const loose = groups.find((g) => g.categoryId === null);
    expect(loose?.amount).toBe(35);
    expect(loose?.items).toHaveLength(2);
  });

  it("does not let float drift into the saved amount", () => {
    // 0.1 + 0.2 is the classic; a receipt of satang-level lines must
    // still round to something a ledger will accept.
    const groups = groupItemsByCategory([
      item("a", 0.1, FOOD),
      item("b", 0.2, FOOD),
    ]);
    expect(groups[0].amount).toBe(0.3);
  });

  it("returns nothing for an empty item list", () => {
    expect(groupItemsByCategory([])).toEqual([]);
  });
});
