/**
 * `resolveRange` is what the transactions-page filter buttons translate
 * into a Supabase query window. The bug we shipped: month boundaries used
 * UTC midnight, so a Bangkok user filtering "this month" missed the
 * 00:00–07:00 Bangkok rows of the 1st (their UTC date was the previous
 * month). These tests pin the corrected behavior.
 */
import { describe, expect, it } from "vitest";
import { resolveRange } from "./date-range";

describe("resolveRange — month boundaries in Asia/Bangkok", () => {
  // The user reported the bug while their wall-clock was around May 1st,
  // morning, Bangkok time. Pick a fake "now" inside that window so the
  // boundaries we compute are the ones that misbehaved.
  const fakeNow = new Date("2026-05-01T05:00:00.000Z"); // = 12:00 Bangkok

  it("'month' window starts at Bangkok midnight, not UTC midnight", () => {
    const r = resolveRange("month", fakeNow);
    // Bangkok midnight May 1 = April 30 17:00 UTC
    expect(r.from).toBe("2026-04-30T17:00:00.000Z");
    // Bangkok midnight June 1 = May 31 17:00 UTC
    expect(r.to).toBe("2026-05-31T17:00:00.000Z");
  });

  it("'prev' window matches Bangkok previous-month boundaries", () => {
    const r = resolveRange("prev", fakeNow);
    // Bangkok midnight April 1 = March 31 17:00 UTC
    expect(r.from).toBe("2026-03-31T17:00:00.000Z");
    // Bangkok midnight May 1 = April 30 17:00 UTC
    expect(r.to).toBe("2026-04-30T17:00:00.000Z");
  });

  it("regression: a Bangkok 03:30 row on the 1st falls into THIS month, not last", () => {
    const r = resolveRange("month", fakeNow);
    // The exact instant the user complained about: 03:46 Bangkok = 20:46 UTC prev day
    const userRowInstant = "2026-04-30T20:46:00.000Z";
    expect(userRowInstant >= r.from!).toBe(true);
    expect(userRowInstant < r.to!).toBe(true);
    // And it must NOT be inside "prev" anymore
    const prev = resolveRange("prev", fakeNow);
    expect(userRowInstant < prev.to!).toBe(false);
  });

  it("'ytd' starts at Bangkok midnight Jan 1, not UTC midnight Jan 1", () => {
    const r = resolveRange("ytd", fakeNow);
    expect(r.from).toBe("2025-12-31T17:00:00.000Z");
    expect(r.to).toBe(fakeNow.toISOString());
  });

  it("'30d' is anchored to the present instant — TZ doesn't shift it", () => {
    const r = resolveRange("30d", fakeNow);
    const expectedFrom = new Date(fakeNow.getTime() - 30 * 24 * 3600_000);
    expect(r.from).toBe(expectedFrom.toISOString());
    expect(r.to).toBe(fakeNow.toISOString());
  });

  it("'today' window covers Bangkok midnight today → tomorrow", () => {
    const r = resolveRange("today", fakeNow);
    // fakeNow = 2026-05-01T05:00:00Z = 12:00 Bangkok May 1
    // Bangkok midnight May 1 = April 30 17:00 UTC
    // Bangkok midnight May 2 = May 1 17:00 UTC
    expect(r.from).toBe("2026-04-30T17:00:00.000Z");
    expect(r.to).toBe("2026-05-01T17:00:00.000Z");
    expect(r.key).toBe("today");
  });

  it("'today' includes the early-morning Bangkok rows that the bug previously stranded", () => {
    const r = resolveRange("today", fakeNow);
    // 03:46 Bangkok May 1 = 20:46 UTC April 30 — same row that used to
    // fall into "เดือนก่อน" because of the UTC-month bug.
    const earlyBangkokRow = "2026-04-30T20:46:00.000Z";
    expect(earlyBangkokRow >= r.from!).toBe(true);
    expect(earlyBangkokRow < r.to!).toBe(true);
  });

  it("'today' rolls month/year cleanly when 'today' is the last day", () => {
    // 2026-12-31 22:00 Bangkok = 2026-12-31 15:00 UTC
    const dec31Bangkok = new Date("2026-12-31T15:00:00.000Z");
    const r = resolveRange("today", dec31Bangkok);
    // Bangkok midnight Dec 31 = Dec 30 17:00 UTC
    expect(r.from).toBe("2026-12-30T17:00:00.000Z");
    // Bangkok midnight Jan 1 = Dec 31 17:00 UTC
    expect(r.to).toBe("2026-12-31T17:00:00.000Z");
  });

  it("'all' returns no bounds", () => {
    const r = resolveRange("all", fakeNow);
    expect(r.from).toBeUndefined();
    expect(r.to).toBeUndefined();
    expect(r.key).toBe("all");
  });

  it("month rollover: late-Dec Bangkok query returns Dec 1 → Jan 1 in Bangkok", () => {
    // 2026-12-31 23:00 Bangkok = 2026-12-31 16:00 UTC
    const dec31LateNight = new Date("2026-12-31T16:00:00.000Z");
    const r = resolveRange("month", dec31LateNight);
    // Bangkok midnight Dec 1 = Nov 30 17:00 UTC
    expect(r.from).toBe("2026-11-30T17:00:00.000Z");
    // Bangkok midnight Jan 1 = Dec 31 17:00 UTC (next year)
    expect(r.to).toBe("2026-12-31T17:00:00.000Z");
  });

  it("month rollover: Bangkok Jan 1 02:00 sees January as 'this month', not December", () => {
    // 2027-01-01 02:00 Bangkok = 2026-12-31 19:00 UTC
    const jan1EarlyMorning = new Date("2026-12-31T19:00:00.000Z");
    const r = resolveRange("month", jan1EarlyMorning);
    // Bangkok midnight Jan 1 2027 = Dec 31 17:00 UTC
    expect(r.from).toBe("2026-12-31T17:00:00.000Z");
    // Bangkok midnight Feb 1 2027 = Jan 31 17:00 UTC 2027
    expect(r.to).toBe("2027-01-31T17:00:00.000Z");
  });
});
