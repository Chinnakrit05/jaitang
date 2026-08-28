import { describe, expect, it } from "vitest";
import {
  matchRecurring,
  textSimilarity,
  type RecurringCandidate,
  type ScanSummary,
} from "@/lib/recurring-match";

const BILLS = "11111111-1111-4111-8111-111111111111";
const FOOD = "22222222-2222-4222-8222-222222222222";

const electricity: RecurringCandidate = {
  id: "r1",
  note: "ค่าไฟ",
  kind: "expense",
  categoryId: BILLS,
  lastFillAmount: 1200,
};

const scan = (over: Partial<ScanSummary> = {}): ScanSummary => ({
  kind: "expense",
  merchant: "การไฟฟ้านครหลวง",
  itemText: "ค่าไฟฟ้าเดือนสิงหาคม",
  amount: 1180,
  categoryIds: [BILLS],
  ...over,
});

describe("textSimilarity", () => {
  it("scores Thai that shares no whitespace-delimited word", () => {
    // The whole point: "ค่าไฟ" and "ค่าไฟฟ้าเดือนสิงหาคม" are the same
    // bill, and no tokenizer would tell you that.
    expect(textSimilarity("ค่าไฟ", "ค่าไฟฟ้าเดือนสิงหาคม")).toBeGreaterThan(0.34);
  });

  it("ignores case, spaces and the [ค่าประจำ] tag", () => {
    expect(textSimilarity("Netflix", "[ค่าประจำ] netflix ")).toBe(1);
  });

  it("gives unrelated text nothing", () => {
    expect(textSimilarity("ค่าไฟ", "เซเว่นอีเลฟเว่น")).toBeLessThan(0.34);
  });

  it("handles an empty side", () => {
    expect(textSimilarity("", "ค่าไฟ")).toBe(0);
  });
});

describe("matchRecurring", () => {
  it("is confident when the category and the wording both line up", () => {
    const m = matchRecurring(scan(), [electricity]);
    expect(m?.ruleId).toBe("r1");
    expect(m?.confidence).toBe("high");
    expect(m?.reasons).toContain("category");
    expect(m?.reasons).toContain("text");
  });

  it("still asks on the category alone, but only as a question", () => {
    const m = matchRecurring(
      scan({ merchant: "ร้านสะดวกซื้อ", itemText: "ของใช้" }),
      [{ ...electricity, lastFillAmount: null }]
    );
    expect(m?.confidence).toBe("medium");
    expect(m?.reasons).toEqual(["category"]);
  });

  it("says nothing when no signal fires", () => {
    expect(
      matchRecurring(
        scan({ merchant: "ร้านกาแฟ", itemText: "ลาเต้", categoryIds: [FOOD] }),
        [{ ...electricity, lastFillAmount: null }]
      )
    ).toBeNull();
  });

  it("never offers a bill to a slip of the other kind", () => {
    // An income slip landing on an expense rule would write a payment
    // the user never made.
    expect(matchRecurring(scan({ kind: "income" }), [electricity])).toBeNull();
  });

  it("counts an amount close to last cycle", () => {
    const m = matchRecurring(
      scan({ merchant: null, itemText: "จ่ายบิล", categoryIds: [BILLS] }),
      [electricity]
    );
    expect(m?.reasons).toEqual(["category", "amount"]);
    expect(m?.confidence).toBe("high");
  });

  it("does not count an amount that is nowhere near last cycle", () => {
    const m = matchRecurring(
      scan({ merchant: null, itemText: "จ่ายบิล", amount: 90, categoryIds: [BILLS] }),
      [electricity]
    );
    expect(m?.reasons).toEqual(["category"]);
  });

  it("picks the better of two candidates in the same category", () => {
    const water: RecurringCandidate = {
      id: "r2",
      note: "ค่าน้ำ",
      kind: "expense",
      categoryId: BILLS,
      lastFillAmount: 300,
    };
    const m = matchRecurring(scan(), [water, electricity]);
    expect(m?.ruleId).toBe("r1");
  });

  it("has nothing to offer when no bill is waiting", () => {
    expect(matchRecurring(scan(), [])).toBeNull();
  });
});
