/**
 * Schema-level tests for the transaction form input. We can't drive the
 * server actions end-to-end without a Supabase double, but we can pin down
 * what the Zod parser accepts/rejects — which is where most "I sent garbage,
 * the row landed corrupt" bugs live.
 *
 * The schema is private to actions.ts. We re-declare the same shape here to
 * keep the test self-contained; if the action's schema ever drifts, the
 * matching test below should drift in lockstep (and any divergence between
 * the two becomes a code-review smell).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

const TxSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0").max(1e12),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(["cash", "transfer"]).nullable().optional(),
  occurredAt: z.string().min(1),
});

const validBase = {
  kind: "expense" as const,
  amount: "100",
  // Zod v4 .uuid() requires a real version digit + variant; use a v4 UUID.
  categoryId: "11111111-1111-4111-8111-111111111111",
  note: "test",
  occurredAt: "2026-05-02T10:30",
};

describe("transaction action TxSchema", () => {
  it("accepts cash payment method", () => {
    const result = TxSchema.safeParse({ ...validBase, paymentMethod: "cash" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paymentMethod).toBe("cash");
  });

  it("accepts transfer payment method", () => {
    const result = TxSchema.safeParse({
      ...validBase,
      paymentMethod: "transfer",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paymentMethod).toBe("transfer");
  });

  it("accepts null payment method (legacy / not-yet-set rows)", () => {
    const result = TxSchema.safeParse({ ...validBase, paymentMethod: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paymentMethod).toBe(null);
  });

  it("accepts missing payment method", () => {
    const result = TxSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects unknown payment method strings", () => {
    const result = TxSchema.safeParse({
      ...validBase,
      paymentMethod: "credit_card",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive amount", () => {
    const result = TxSchema.safeParse({ ...validBase, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects amount above the 1e12 ceiling", () => {
    const result = TxSchema.safeParse({ ...validBase, amount: "2e12" });
    expect(result.success).toBe(false);
  });

  it("requires occurredAt", () => {
    const result = TxSchema.safeParse({ ...validBase, occurredAt: "" });
    expect(result.success).toBe(false);
  });

  it("coerces stringy amount into a number (FormData always yields strings)", () => {
    const result = TxSchema.safeParse({ ...validBase, amount: "12.34" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(12.34);
  });
});
