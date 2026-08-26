import { describe, expect, it } from "vitest";
import { computeNextRun, nextRunAfterFill } from "@/lib/recurring";

/** Tests run under TZ=Asia/Bangkok (see package.json), and the
 *  scheduling helpers work in local time, so anchors are written with
 *  an explicit +07:00 offset to stay readable. */
const monthly = (nextRunAt: string, dayOfMonth = 27) => ({
  period: "monthly" as const,
  day_of_month: dayOfMonth,
  day_of_week: null,
  next_run_at: nextRunAt,
});

/** Local calendar fields — comparing these beats comparing ISO
 *  strings when the point of the assertion is "which day". */
function local(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    hh: d.getHours(),
    mm: d.getMinutes(),
  };
}

describe("computeNextRun", () => {
  it("steps exactly one period, ignoring today's date", () => {
    // The backfill loop in applyDueRecurring depends on this staying
    // a blind single step.
    const next = computeNextRun(monthly("2026-06-27T15:39:00+07:00"));
    expect(local(next)).toMatchObject({ y: 2026, m: 7, d: 27 });
  });

  it("clamps to the last day of a short month", () => {
    const next = computeNextRun(monthly("2026-01-31T09:00:00+07:00", 31));
    expect(local(next)).toMatchObject({ y: 2026, m: 2, d: 28 });
  });
});

describe("nextRunAfterFill", () => {
  const asOf = new Date(2026, 7, 26, 10, 0, 0); // 26 Aug 2026, local

  it("advances one month when the due date is the current period", () => {
    const next = nextRunAfterFill(monthly("2026-08-27T15:39:00+07:00"), asOf);
    expect(local(next)).toMatchObject({ y: 2026, m: 9, d: 27 });
  });

  it("advances one month at a time when catching up on overdue bills", () => {
    // Filling June's bill in August should surface July next, not
    // skip ahead to September.
    const next = nextRunAfterFill(monthly("2026-06-27T15:39:00+07:00"), asOf);
    expect(local(next)).toMatchObject({ y: 2026, m: 7, d: 27 });
  });

  it("does not advance twice when the same period is edited again", () => {
    // Rule already rolled to September; re-editing August's amount
    // must not push it to October.
    const next = nextRunAfterFill(monthly("2026-09-27T15:39:00+07:00"), asOf);
    expect(local(next)).toMatchObject({ y: 2026, m: 9, d: 27 });
  });

  it("pulls a rule that already drifted back to the calendar", () => {
    // Regression: repeated edits had walked a monthly rule out to
    // December, silently skipping Sep/Oct/Nov.
    const next = nextRunAfterFill(monthly("2026-12-27T15:39:00+07:00"), asOf);
    expect(local(next)).toMatchObject({ y: 2026, m: 9, d: 27 });
  });

  it("keeps the rule's established time of day", () => {
    const next = nextRunAfterFill(monthly("2026-12-27T15:39:00+07:00"), asOf);
    expect(local(next)).toMatchObject({ hh: 15, mm: 39 });
  });

  it("clamps the capped result to a short month", () => {
    const jan = new Date(2026, 0, 15, 10, 0, 0);
    const next = nextRunAfterFill(monthly("2026-09-30T08:00:00+07:00", 31), jan);
    expect(local(next)).toMatchObject({ y: 2026, m: 2, d: 28 });
  });

  it("caps a drifted daily rule at tomorrow", () => {
    const next = nextRunAfterFill(
      {
        period: "daily",
        day_of_month: null,
        day_of_week: null,
        next_run_at: "2026-09-10T07:00:00+07:00",
      },
      asOf,
    );
    expect(local(next)).toMatchObject({ y: 2026, m: 8, d: 27 });
  });

  it("caps a drifted weekly rule at its weekday in the following week", () => {
    // asOf is Wed 26 Aug 2026; day_of_week 3 = Wednesday, so the next
    // bucket's occurrence is Wed 2 Sep.
    const next = nextRunAfterFill(
      {
        period: "weekly",
        day_of_month: null,
        day_of_week: 3,
        next_run_at: "2026-10-07T08:00:00+07:00",
      },
      asOf,
    );
    expect(local(next)).toMatchObject({ y: 2026, m: 9, d: 2 });
  });

  it("caps a drifted yearly rule at next year", () => {
    const next = nextRunAfterFill(
      {
        period: "yearly",
        day_of_month: 27,
        day_of_week: null,
        next_run_at: "2029-08-27T15:39:00+07:00",
      },
      asOf,
    );
    expect(local(next)).toMatchObject({ y: 2027, m: 8, d: 27 });
  });
});

describe("computeNextRun month-length overflow", () => {
  // Regression: stepping the month while sitting on the 31st rolled
  // past the shorter target month, so day-31 rules skipped February
  // and April entirely instead of clamping into them.
  it("lands in February, not March, for a day-31 rule", () => {
    const next = computeNextRun({
      period: "monthly",
      day_of_month: 31,
      day_of_week: null,
      next_run_at: "2026-01-31T09:00:00+07:00",
    });
    expect(local(next)).toMatchObject({ y: 2026, m: 2, d: 28 });
  });

  it("lands in April, not May, for a day-31 rule", () => {
    const next = computeNextRun({
      period: "monthly",
      day_of_month: 31,
      day_of_week: null,
      next_run_at: "2026-03-31T09:00:00+07:00",
    });
    expect(local(next)).toMatchObject({ y: 2026, m: 4, d: 30 });
  });

  it("restores the anchor day after a short month", () => {
    // Clamping to Feb 28 must not permanently pin the rule to the
    // 28th — day_of_month is the source of truth.
    const feb = computeNextRun({
      period: "monthly",
      day_of_month: 31,
      day_of_week: null,
      next_run_at: "2026-02-28T09:00:00+07:00",
    });
    expect(local(feb)).toMatchObject({ y: 2026, m: 3, d: 31 });
  });

  it("keeps the anchor day when day_of_month is unset", () => {
    const next = computeNextRun({
      period: "monthly",
      day_of_month: null,
      day_of_week: null,
      next_run_at: "2026-03-15T09:00:00+07:00",
    });
    expect(local(next)).toMatchObject({ y: 2026, m: 4, d: 15 });
  });

  it("clamps a Feb 29 yearly rule to Feb 28 in a non-leap year", () => {
    const next = computeNextRun({
      period: "yearly",
      day_of_month: 29,
      day_of_week: null,
      next_run_at: "2028-02-29T09:00:00+07:00",
    });
    expect(local(next)).toMatchObject({ y: 2029, m: 2, d: 28 });
  });
});
