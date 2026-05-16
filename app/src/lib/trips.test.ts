/**
 * Tests for `listTrips`'s in-memory aggregation step. The Supabase fetch is
 * mocked at the module boundary so the math under test is the JS that
 * folds transactions into per-trip totals — that's where rounding/drift
 * bugs would live, not in the SQL.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Supabase BEFORE importing the lib so the lib picks up our fakes.
const ledgerId = "ledger-1";

const tripsRows = [
  {
    id: "t1",
    ledger_id: ledgerId,
    name: "ทริปทะเล",
    icon: "🏖️",
    color: "#06b6d4",
    starts_at: "2026-05-01T17:00:00.000Z",
    ends_at: "2026-05-05T17:00:00.000Z",
    archived: false,
    created_at: "2026-04-30T10:00:00.000Z",
  },
  {
    id: "t2",
    ledger_id: ledgerId,
    name: "ทริปเชียงใหม่",
    icon: "🏔️",
    color: "#10b981",
    starts_at: null,
    ends_at: null,
    archived: true,
    created_at: "2026-03-15T10:00:00.000Z",
  },
];

const txRows = [
  { trip_id: "t1", kind: "expense", amount: 274 },
  { trip_id: "t1", kind: "expense", amount: 95 },
  { trip_id: "t1", kind: "income", amount: 500 }, // refund
  { trip_id: "t2", kind: "expense", amount: 1200 },
  // unrelated
  { trip_id: null, kind: "expense", amount: 999 },
];

vi.mock("@/lib/supabase/server", () => {
  const builder = () => {
    const out: {
      from: (t: string) => typeof api;
    } = { from: vi.fn() };

    const api = {
      _table: "" as string,
      _includeArchived: true,
      _idsFilter: null as string[] | null,
      from(table: string) {
        api._table = table;
        return api;
      },
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        if (col === "archived" && val === false) api._includeArchived = false;
        return api;
      },
      in(col: string, ids: string[]) {
        if (col === "trip_id") api._idsFilter = ids;
        return api;
      },
      // Soft-delete filter — fixtures don't include `deleted_at`, accept
      // the call and let every row pass.
      is() {
        return api;
      },
      order() {
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        if (api._table === "trips") {
          const rows = api._includeArchived
            ? tripsRows
            : tripsRows.filter((t) => !t.archived);
          resolve({ data: rows, error: null });
        } else {
          // transactions
          const rows = api._idsFilter
            ? txRows.filter(
                (r) => r.trip_id && api._idsFilter!.includes(r.trip_id)
              )
            : txRows;
          resolve({ data: rows, error: null });
        }
        return Promise.resolve();
      },
    };

    out.from = api.from;
    return out;
  };

  return {
    getServerSupabase: () => builder(),
  };
});

import { listTrips } from "./trips";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTrips — aggregation", () => {
  it("returns active + archived totals, with stats matching the source rows", async () => {
    const out = await listTrips(ledgerId, { includeArchived: true });
    expect(out).toHaveLength(2);

    const beach = out.find((t) => t.id === "t1")!;
    expect(beach.name).toBe("ทริปทะเล");
    expect(beach.txCount).toBe(3);
    expect(beach.totalExpense).toBe(274 + 95);
    expect(beach.totalIncome).toBe(500);

    const cm = out.find((t) => t.id === "t2")!;
    expect(cm.archived).toBe(true);
    expect(cm.txCount).toBe(1);
    expect(cm.totalExpense).toBe(1200);
    expect(cm.totalIncome).toBe(0);
  });

  it("hides archived trips by default", async () => {
    const out = await listTrips(ledgerId);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("t1");
  });

  it("doesn't leak the trip_id=null transactions into any bucket", async () => {
    const out = await listTrips(ledgerId, { includeArchived: true });
    const sumOfTripExpenses = out.reduce(
      (acc, t) => acc + t.totalExpense,
      0
    );
    // 274 + 95 + 1200 = 1569 — explicitly excludes the orphan 999
    expect(sumOfTripExpenses).toBe(1569);
  });
});
