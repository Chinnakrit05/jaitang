import { describe, expect, it } from "vitest";
import { backupDateKey, backupPath, isBackupDateKey, namesToPrune } from "./auto-backup";

describe("backupDateKey", () => {
  it("files the 03:00 run under the Bangkok day, not the UTC one", () => {
    // 20:00 UTC on the 24th is 03:00 on the 25th in Bangkok.
    expect(backupDateKey(new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
  });

  it("is the same day for a run just after Bangkok midnight", () => {
    expect(backupDateKey(new Date("2026-11-24T17:00:00Z"))).toBe("2026-11-25");
    expect(backupDateKey(new Date("2026-11-24T16:59:59Z"))).toBe("2026-11-24");
  });
});

describe("backupPath", () => {
  it("keeps each user in their own folder", () => {
    expect(backupPath("user-1", "2026-11-25")).toBe("user-1/2026-11-25.json");
  });
});

describe("isBackupDateKey", () => {
  it("takes a real date and refuses anything else", () => {
    expect(isBackupDateKey("2026-11-25")).toBe(true);
    expect(isBackupDateKey("2026-13-01")).toBe(false);
    expect(isBackupDateKey("../other-user/2026-11-25")).toBe(false);
    expect(isBackupDateKey("2026-11-25.json")).toBe(false);
  });
});

describe("namesToPrune", () => {
  const names = ["2026-10-26.json", "2026-10-27.json", "2026-11-25.json", "notes.txt", "x.json"];

  it("keeps the last 30 days counting today, drops the day before", () => {
    // 30 days ending 25 Nov start on 27 Oct.
    expect(namesToPrune(names, "2026-11-25", 30)).toEqual(["2026-10-26.json"]);
  });

  it("never touches a file it didn't name", () => {
    expect(namesToPrune(["notes.txt", "x.json", ".emptyFolderPlaceholder"], "2026-11-25", 1)).toEqual([]);
  });
});
