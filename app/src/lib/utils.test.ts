import { describe, expect, it } from "vitest";
import { toLocalDateTimeInput } from "./utils";

describe("toLocalDateTimeInput", () => {
  // The test runner sets process.env.TZ before any Date is constructed (see
  // package.json `test` script: `TZ=Asia/Bangkok vitest run`). All cases below
  // assume Asia/Bangkok = UTC+7, no DST.

  it("formats an ISO string in the runtime's timezone", () => {
    // 2026-05-02T03:30:00Z = 2026-05-02 10:30 in Bangkok
    expect(toLocalDateTimeInput("2026-05-02T03:30:00Z")).toBe(
      "2026-05-02T10:30"
    );
  });

  it("rolls over to the next local day when UTC is late evening", () => {
    // 2026-05-02T22:00:00Z = 2026-05-03 05:00 in Bangkok
    expect(toLocalDateTimeInput("2026-05-02T22:00:00Z")).toBe(
      "2026-05-03T05:00"
    );
  });

  it("zero-pads months, days, hours, and minutes", () => {
    // 2026-01-04T00:00:00Z + 7h = 2026-01-04 07:00 Bangkok
    expect(toLocalDateTimeInput("2026-01-04T00:00:00Z")).toBe(
      "2026-01-04T07:00"
    );
    // 2026-09-09T01:05:00Z + 7h = 2026-09-09 08:05 Bangkok
    expect(toLocalDateTimeInput("2026-09-09T01:05:00Z")).toBe(
      "2026-09-09T08:05"
    );
  });

  it("accepts a Date object (used by the new-tx path: new Date().toISOString())", () => {
    // Equivalent to passing the same string
    const d = new Date("2026-05-02T03:30:00Z");
    expect(toLocalDateTimeInput(d)).toBe("2026-05-02T10:30");
  });

  it("regression: the bug we shipped — pre-fix, the new-tx default would render with the SERVER's TZ. This test pins down what 'correct' looks like in Bangkok and so guards future SSR-time accidents.", () => {
    // Imagine `new Date()` returned right now, but we feed it a known instant.
    // If the runtime were UTC, we'd get "2026-05-02T03:30" (wrong from a
    // Bangkok user's perspective). The test runs under TZ=Asia/Bangkok and
    // gets "10:30", proving the function honors the runtime TZ as specified.
    expect(toLocalDateTimeInput("2026-05-02T03:30:00.000Z")).not.toBe(
      "2026-05-02T03:30"
    );
    expect(toLocalDateTimeInput("2026-05-02T03:30:00.000Z")).toBe(
      "2026-05-02T10:30"
    );
  });
});
