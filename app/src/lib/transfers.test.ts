/**
 * Tests for the transfers lib. Mocks Supabase at the module boundary
 * to focus on listTransfersForAccount's join-row reshaping (the
 * supabase-js shape is "FK column" → either object or array depending
 * on inferences, which we normalize to a single object).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => {
  const transferRows = [
    {
      id: "tr1",
      ledger_id: "L",
      user_id: "u1",
      from_account_id: "a1",
      to_account_id: "a2",
      from_amount: "500",
      from_currency: "THB",
      to_amount: "2000",
      to_currency: "JPY",
      fx_rate: "4.0",
      note: "Tokyo trip topup",
      occurred_at: "2026-04-30T05:00:00Z",
      created_at: "2026-04-30T05:00:00Z",
      // PostgREST returns FK joins either as object or [object] depending
      // on cardinality inference. listTransfersForAccount normalizes both.
      fromAccount: { id: "a1", name: "Cash", icon: "💵", color: "#10b981" },
      toAccount: [
        { id: "a2", name: "JPY wallet", icon: "📱", color: "#3b82f6" },
      ],
    },
    {
      id: "tr2",
      ledger_id: "L",
      user_id: "u1",
      from_account_id: "a2",
      to_account_id: "a1",
      from_amount: "800",
      from_currency: "JPY",
      to_amount: "200",
      to_currency: "THB",
      fx_rate: "0.25",
      note: null,
      occurred_at: "2026-04-29T05:00:00Z",
      created_at: "2026-04-29T05:00:00Z",
      fromAccount: null, // deleted account on one side
      toAccount: { id: "a1", name: "Cash", icon: "💵", color: "#10b981" },
    },
  ];

  const builder = () => {
    const api = {
      _table: "" as string,
      from(table: string) {
        api._table = table;
        return api;
      },
      select() {
        return api;
      },
      eq() {
        return api;
      },
      or() {
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        if (api._table === "transfers") {
          resolve({ data: transferRows, error: null });
        } else {
          resolve({ data: [], error: null });
        }
        return Promise.resolve();
      },
    };
    return { from: api.from };
  };

  return { getServerSupabase: () => builder() };
});

import { listTransfersForAccount } from "./transfers";

describe("listTransfersForAccount", () => {
  it("returns rows for the account, normalizes object/array join shapes", async () => {
    const rows = await listTransfersForAccount("a1", "L");
    expect(rows).toHaveLength(2);
    // First row: fromAccount as object, toAccount wrapped as array — both
    // should land as a single object.
    expect(rows[0].fromAccount).toEqual({
      id: "a1",
      name: "Cash",
      icon: "💵",
      color: "#10b981",
    });
    expect(rows[0].toAccount).toEqual({
      id: "a2",
      name: "JPY wallet",
      icon: "📱",
      color: "#3b82f6",
    });
  });

  it("preserves null when a side has no joinable account row", async () => {
    const rows = await listTransfersForAccount("a1", "L");
    expect(rows[1].fromAccount).toBeNull();
    expect(rows[1].toAccount?.id).toBe("a1");
  });

  it("converts numeric strings to Number for the amounts + rate", async () => {
    const rows = await listTransfersForAccount("a1", "L");
    expect(rows[0].from_amount).toBe(500);
    expect(rows[0].to_amount).toBe(2000);
    expect(rows[0].fx_rate).toBe(4.0);
    // Sanity: implied rate matches stored rate
    expect(rows[0].to_amount / rows[0].from_amount).toBeCloseTo(rows[0].fx_rate, 4);
  });
});

describe("cross-currency transfer math (documentation-only)", () => {
  // The actual math lives in createTransferAction; this test pins down
  // the contract for callers reading the lib alone:
  //   - same-currency: toAmount = fromAmount, rate = 1
  //   - user-supplied toAmount: rate = toAmount / fromAmount (Wise-style)
  //   - otherwise: server fetches a market rate
  it("user-supplied toAmount derives the implicit rate", () => {
    const fromAmount = 100; // USD
    const toAmount = 3550; // THB the bank actually credited
    const rate = toAmount / fromAmount;
    expect(rate).toBe(35.5);
    // round-trip: applying the rate back gives the toAmount
    expect(fromAmount * rate).toBe(toAmount);
  });
});
