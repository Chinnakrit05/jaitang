import { describe, expect, it } from "vitest";
import { equalSplit } from "./splits";

describe("equalSplit", () => {
  it("returns an empty map for an empty member list", () => {
    expect(Array.from(equalSplit(100, []).entries())).toEqual([]);
  });

  it("splits cleanly when total divides evenly", () => {
    const result = equalSplit(120, ["a", "b", "c"]);
    expect(result.get("a")).toBe(40);
    expect(result.get("b")).toBe(40);
    expect(result.get("c")).toBe(40);
  });

  it("distributes the cent remainder to the earlier members", () => {
    // 100 / 3 = 33.33 each, but we owe 100 exactly. The first member gets +0.01.
    const result = equalSplit(100, ["a", "b", "c"]);
    const sum = (result.get("a") ?? 0) + (result.get("b") ?? 0) + (result.get("c") ?? 0);
    // No float drift — must sum to 100 to the cent.
    expect(Math.round(sum * 100)).toBe(10000);
    // First one gets the extra penny
    expect(result.get("a")).toBeGreaterThanOrEqual(result.get("b") ?? 0);
    expect(result.get("b")).toBe(result.get("c"));
  });

  it("does not drift on tricky decimals (650.45 / 7)", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const result = equalSplit(650.45, ids);
    const sumCents = ids.reduce(
      (s, id) => s + Math.round((result.get(id) ?? 0) * 100),
      0
    );
    expect(sumCents).toBe(65045);
  });

  it("handles the single-member case (rare but legal)", () => {
    const result = equalSplit(99.99, ["solo"]);
    expect(result.get("solo")).toBe(99.99);
  });
});
