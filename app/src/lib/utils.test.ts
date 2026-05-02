import { describe, expect, it } from "vitest";
import { dayKeyInTz, toLocalDateTimeInput, yearMonthInTz } from "./utils";

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

describe("dayKeyInTz", () => {
  it("uses the runtime TZ when no tz is passed (browser case)", () => {
    // 2026-05-01T20:46:00Z = 2026-05-02 03:46 in Bangkok — different UTC
    // and Bangkok dates. Test runner is TZ=Asia/Bangkok, so this proves
    // the default-arg path picks up the user's local calendar day.
    expect(dayKeyInTz("2026-05-01T20:46:00Z")).toBe("2026-05-02");
  });

  it("respects an explicit timezone (server-side BUSINESS_TZ case)", () => {
    expect(dayKeyInTz("2026-05-01T20:46:00Z", "Asia/Bangkok")).toBe("2026-05-02");
    expect(dayKeyInTz("2026-05-01T20:46:00Z", "UTC")).toBe("2026-05-01");
    // Honolulu is UTC-10, so the same instant is still May 1 there
    expect(dayKeyInTz("2026-05-01T20:46:00Z", "Pacific/Honolulu")).toBe(
      "2026-05-01"
    );
  });

  it("regression: the user-reported screenshot bug", () => {
    // From the bug report: "บาร์ปีกนก" was shown as 2 พ.ค. 03:46 Bangkok
    // but grouped under 1 พ.ค. — because the grouping code did
    // `iso.slice(0, 10)` which is the UTC date. Verify the new helper
    // produces the local date that matches what the user sees.
    const occurredAt = "2026-05-01T20:46:00Z"; // = 03:46 Bangkok next day
    expect(dayKeyInTz(occurredAt, "Asia/Bangkok")).toBe("2026-05-02");
  });

  it("handles the lexicographic ordering invariant the byDay sort relies on", () => {
    // The dashboard's byDay array is sorted by `day.localeCompare(b.day)`.
    // With YYYY-MM-DD strings, lexicographic order equals chronological
    // order — but only because we zero-pad. Spot-check the padding here.
    expect(dayKeyInTz("2026-01-09T05:00:00Z", "Asia/Bangkok")).toBe(
      "2026-01-09"
    );
    expect(dayKeyInTz("2026-09-01T05:00:00Z", "Asia/Bangkok")).toBe(
      "2026-09-01"
    );
  });
});

describe("yearMonthInTz — used by import wizard's per-month aggregation", () => {
  it("returns Bangkok year/month for a late-UTC instant", () => {
    // 2026-04-30T20:35Z = 2026-05-01 03:35 Bangkok — should resolve to
    // May 2026, NOT April 2026 (this is the import-preview-shows-2-months
    // bug, in test form).
    expect(yearMonthInTz("2026-04-30T20:35:00Z", "Asia/Bangkok")).toEqual({
      year: 2026,
      month: 5,
    });
  });

  it("returns the UTC year/month when tz=UTC", () => {
    expect(yearMonthInTz("2026-04-30T20:35:00Z", "UTC")).toEqual({
      year: 2026,
      month: 4,
    });
  });

  it("regression: a one-month export that contains an early-Bangkok-morning row stays in one bucket", () => {
    // Hand-built fixture mimicking what `parseJaitangCsv` produces from
    // an export of "May 2026 only" data on a Bangkok ledger.
    const rows = [
      { occurredAt: "2026-05-01T07:59:00Z" }, // 14:59 Bangkok, May 1
      { occurredAt: "2026-05-01T14:00:00Z" }, // 21:00 Bangkok, May 1
      { occurredAt: "2026-04-30T20:46:00Z" }, // 03:46 Bangkok, May 2
      { occurredAt: "2026-04-30T20:35:00Z" }, // 03:35 Bangkok, May 1
    ];
    const buckets = new Set<string>();
    for (const r of rows) {
      const { year, month } = yearMonthInTz(r.occurredAt, "Asia/Bangkok");
      buckets.add(`${year}-${month}`);
    }
    // All four rows are May 2026 in Bangkok → one bucket only.
    expect(Array.from(buckets)).toEqual(["2026-5"]);
  });
});
