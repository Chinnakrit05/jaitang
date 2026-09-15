import { describe, expect, it } from "vitest";
import {
  matchRecurring,
  nameReadsLike,
  scanMonth,
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

describe("the cat bucket", () => {
  const CAT = "33333333-3333-4333-8333-333333333333";
  const OTHER = "44444444-4444-4444-8444-444444444444";
  const cat: RecurringCandidate = {
    id: "cat",
    note: "แมว",
    kind: "expense",
    categoryId: CAT,
    lastFillAmount: 1805,
  };
  const receipt: ScanSummary = {
    kind: "expense",
    merchant: "Pet Planet",
    itemText: "อาหารแมว ทรายแมว ขนมแมว",
    amount: 640,
    categoryIds: [CAT],
  };

  it("finds a short rule name written inside the receipt lines", () => {
    // Dice alone scores this 0.18 — a three-letter name inside a long
    // line — and the text signal used to miss it entirely.
    expect(textSimilarity("แมว", receipt.itemText)).toBeLessThan(0.34);
    expect(nameReadsLike("แมว", receipt.itemText)).toBe(true);
  });

  it("is confident when both the category and the lines say แมว", () => {
    const m = matchRecurring(receipt, [cat]);
    expect(m?.ruleId).toBe("cat");
    expect(m?.confidence).toBe("high");
    expect(m?.reasons).toEqual(["category", "text"]);
  });

  it("still asks when the lines were filed under another category", () => {
    const m = matchRecurring({ ...receipt, categoryIds: [OTHER] }, [cat]);
    expect(m?.ruleId).toBe("cat");
    expect(m?.reasons).toEqual(["text"]);
    expect(m?.confidence).toBe("medium");
  });

  it("doesn't let a two-letter name match anything that contains it", () => {
    // Containment only counts from three letters up; below that the
    // name has to be genuinely similar, not merely present.
    expect(nameReadsLike("AB", "ABC Mart")).toBe(false);
  });
});

describe("scanMonth", () => {
  const now = new Date("2026-09-15T05:00:00Z");

  it("reads the month in Bangkok time, not UTC", () => {
    // 00:30 on 1 September in Bangkok is still 31 August in UTC.
    expect(scanMonth("2026-09-01T00:30:00+07:00", now)).toEqual({ year: 2026, month: 9 });
    expect(scanMonth("2026-08-31T23:30:00+07:00", now)).toEqual({ year: 2026, month: 8 });
  });

  it("takes a date-only receipt at face value", () => {
    expect(scanMonth("2026-07-04", now)).toEqual({ year: 2026, month: 7 });
  });

  it("falls back to today when the receipt had no readable date", () => {
    expect(scanMonth(null, now)).toEqual({ year: 2026, month: 9 });
    expect(scanMonth("not a date", now)).toEqual({ year: 2026, month: 9 });
  });
});
