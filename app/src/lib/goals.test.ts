/**
 * Tests for the goal aggregation math. Mocks Supabase at the module
 * boundary so the focus is the JS that turns goal+contributions rows
 * into the `GoalStats` shape consumed by the UI.
 */
import { describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-05-01T05:00:00.000Z"); // 12:00 Bangkok May 1
vi.useFakeTimers();
vi.setSystemTime(NOW);

vi.mock("@/lib/supabase/server", () => {
  const goalsRows = [
    {
      id: "g1",
      ledger_id: "L",
      name: "Korea trip",
      icon: "✈️",
      color: "#3b82f6",
      target_amount: "100000",
      // ~6 months out (Nov 1 noon Bangkok)
      deadline: "2026-11-01T05:00:00.000Z",
      archived: false,
      created_at: "2026-04-01T00:00:00Z",
    },
    {
      id: "g2",
      ledger_id: "L",
      name: "Emergency fund",
      icon: "🎯",
      color: "#10b981",
      target_amount: "50000",
      deadline: null,
      archived: false,
      created_at: "2026-04-01T00:00:00Z",
    },
    {
      id: "g3",
      ledger_id: "L",
      name: "Already done",
      icon: "🏆",
      color: "#f59e0b",
      target_amount: "10000",
      deadline: null,
      archived: false,
      created_at: "2026-03-01T00:00:00Z",
    },
    {
      id: "g4",
      ledger_id: "L",
      name: "Old retired",
      icon: "📦",
      color: "#64748b",
      target_amount: "5000",
      deadline: null,
      archived: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const contribRows = [
    { goal_id: "g1", amount: "20000" },
    { goal_id: "g1", amount: "5000" },
    { goal_id: "g2", amount: "12500" },
    { goal_id: "g3", amount: "10000" }, // exact target
    { goal_id: "g3", amount: "200" }, // overshoot
  ];

  const builder = () => {
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
        if (col === "goal_id") api._idsFilter = ids;
        return api;
      },
      order() {
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        if (api._table === "goals") {
          const rows = api._includeArchived
            ? goalsRows
            : goalsRows.filter((g) => !g.archived);
          resolve({ data: rows, error: null });
        } else {
          // goal_contributions
          const rows = api._idsFilter
            ? contribRows.filter((r) => api._idsFilter!.includes(r.goal_id))
            : contribRows;
          resolve({ data: rows, error: null });
        }
        return Promise.resolve();
      },
    };
    return { from: api.from };
  };

  return { getServerSupabase: () => builder() };
});

import { listGoals } from "./goals";

describe("listGoals — aggregation", () => {
  it("includes archived when asked, excludes by default", async () => {
    const all = await listGoals("L", { includeArchived: true });
    expect(all).toHaveLength(4);

    const active = await listGoals("L");
    expect(active).toHaveLength(3);
    expect(active.every((g) => !g.archived)).toBe(true);
  });

  it("computes currentAmount as the sum of contributions", async () => {
    const goals = await listGoals("L", { includeArchived: true });
    const korea = goals.find((g) => g.id === "g1")!;
    expect(korea.currentAmount).toBe(25000); // 20000 + 5000
    expect(korea.target_amount).toBe(100000);
    expect(korea.progress).toBeCloseTo(0.25, 4);
    expect(korea.achieved).toBe(false);
  });

  it("flags achieved when current >= target (and overshoots show > 100% progress)", async () => {
    const goals = await listGoals("L", { includeArchived: true });
    const overshoot = goals.find((g) => g.id === "g3")!;
    expect(overshoot.currentAmount).toBe(10200);
    expect(overshoot.achieved).toBe(true);
    expect(overshoot.progress).toBeGreaterThan(1);
  });

  it("returns null deadline math when no deadline is set", async () => {
    const goals = await listGoals("L", { includeArchived: true });
    const noDeadline = goals.find((g) => g.id === "g2")!;
    expect(noDeadline.monthsRemaining).toBeNull();
    expect(noDeadline.monthlyRequired).toBeNull();
  });

  it("computes monthsRemaining + monthlyRequired for goals with a deadline", async () => {
    const goals = await listGoals("L", { includeArchived: true });
    const korea = goals.find((g) => g.id === "g1")!;
    // ~6 months out, 75k remaining → ~12.5k/month
    expect(korea.monthsRemaining).toBeGreaterThanOrEqual(5);
    expect(korea.monthsRemaining).toBeLessThanOrEqual(7);
    expect(korea.monthlyRequired).toBeGreaterThan(0);
    expect(korea.monthlyRequired!).toBeCloseTo(75000 / korea.monthsRemaining!, 2);
  });

  it("does not propose monthlyRequired once a goal is achieved", async () => {
    const goals = await listGoals("L", { includeArchived: true });
    const overshoot = goals.find((g) => g.id === "g3")!;
    expect(overshoot.monthlyRequired).toBeNull();
  });
});
