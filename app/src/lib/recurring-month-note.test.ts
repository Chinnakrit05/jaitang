import { describe, expect, it } from "vitest";
import {
  mergeMonthNote,
  monthNoteKey,
  readMonthNotes,
} from "@/lib/recurring-month-note";

describe("monthNoteKey", () => {
  it("zero-pads so the key sorts and matches the ym in the URL", () => {
    expect(monthNoteKey(2026, 5)).toBe("2026-05");
    expect(monthNoteKey(2026, 12)).toBe("2026-12");
  });
});

describe("readMonthNotes", () => {
  it("keeps string entries", () => {
    expect(readMonthNotes({ "2026-05": "จ่ายรวม 2 เดือน" })).toEqual({
      "2026-05": "จ่ายรวม 2 เดือน",
    });
  });

  it("survives a rule that predates the column", () => {
    expect(readMonthNotes(null)).toEqual({});
    expect(readMonthNotes(undefined)).toEqual({});
  });

  it("drops anything that is not a note", () => {
    // The column is jsonb with no shape enforced — rendering a number
    // or an object here would be a crash, not a note.
    expect(
      readMonthNotes({ "2026-05": 42, "2026-06": { a: 1 }, "2026-07": "ok" })
    ).toEqual({ "2026-07": "ok" });
    expect(readMonthNotes(["2026-05"])).toEqual({});
  });

  it("drops a blank note", () => {
    expect(readMonthNotes({ "2026-05": "   " })).toEqual({});
  });
});

describe("mergeMonthNote", () => {
  it("adds a month without touching the others", () => {
    const before = { "2026-04": "เดือนก่อน" };
    const after = mergeMonthNote(before, "2026-05", "เดือนนี้");
    expect(after).toEqual({ "2026-04": "เดือนก่อน", "2026-05": "เดือนนี้" });
    expect(before).toEqual({ "2026-04": "เดือนก่อน" });
  });

  it("trims what it stores", () => {
    expect(mergeMonthNote({}, "2026-05", "  ค่าน้ำรวม  ")).toEqual({
      "2026-05": "ค่าน้ำรวม",
    });
  });

  it("removes the key when the note is cleared", () => {
    // Not "" — the UI decides whether to show a chip by whether the
    // key is there at all.
    expect(mergeMonthNote({ "2026-05": "x" }, "2026-05", "")).toEqual({});
    expect(mergeMonthNote({ "2026-05": "x" }, "2026-05", "   ")).toEqual({});
  });

  it("clearing a month leaves the rest alone", () => {
    expect(
      mergeMonthNote({ "2026-04": "keep", "2026-05": "drop" }, "2026-05", "")
    ).toEqual({ "2026-04": "keep" });
  });
});
