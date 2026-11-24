import { describe, expect, it } from "vitest";
import { summarizeChange, toSnapshot, type ChangeRecord } from "./change-log";

const row = (over: Record<string, unknown> = {}) => ({
  id: "tx-1",
  amount: 949.65,
  kind: "expense",
  note: "[ค่าประจำ]",
  category_id: "cat-home",
  occurred_at: "2026-11-27T00:00:00+00:00",
  deleted_at: null,
  skipped: false,
  recurring_id: "rule-1",
  ...over,
});

function change(
  op: ChangeRecord["op"],
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null,
): ChangeRecord {
  return {
    id: 1,
    op,
    changedAt: "2026-11-24T16:24:51Z",
    actorId: null,
    via: null,
    before: toSnapshot(oldRow),
    after: toSnapshot(newRow),
  };
}

describe("summarizeChange", () => {
  it("a month filled for the first time is an add", () => {
    expect(summarizeChange(change("insert", null, row()))).toEqual({ kind: "added", amount: 949.65 });
  });

  it("an add marked '-' has no figure", () => {
    expect(summarizeChange(change("insert", null, row({ amount: 0, skipped: true })))).toEqual({
      kind: "added",
      amount: null,
    });
  });

  it("a scan added on top reads from → to", () => {
    expect(summarizeChange(change("update", row(), row({ amount: 1589.65 })))).toEqual({
      kind: "amount",
      from: 949.65,
      to: 1589.65,
    });
  });

  it("a '-' month that gets a figure reads from nothing", () => {
    expect(
      summarizeChange(change("update", row({ amount: 0, skipped: true }), row({ amount: 500 }))),
    ).toEqual({ kind: "amount", from: null, to: 500 });
  });

  it("a soft delete is a delete, with what it held", () => {
    expect(
      summarizeChange(change("update", row(), row({ deleted_at: "2026-11-25T01:00:00Z" }))),
    ).toEqual({ kind: "deleted", amount: 949.65 });
  });

  it("undo is a restore", () => {
    expect(
      summarizeChange(change("update", row({ deleted_at: "2026-11-25T01:00:00Z" }), row())),
    ).toEqual({ kind: "restored", amount: 949.65 });
  });

  it("a hard delete is a delete too", () => {
    expect(summarizeChange(change("delete", row(), null))).toEqual({ kind: "deleted", amount: 949.65 });
  });

  it("names the fields an edit touched when the amount stayed", () => {
    expect(
      summarizeChange(
        change(
          "update",
          row({ note: "ข้าว", category_id: "a" }),
          row({ note: "ข้าวมันไก่", category_id: "b" }),
        ),
      ),
    ).toEqual({ kind: "edited", fields: ["note", "category"] });
  });

  it("the same instant written two ways is not a date change", () => {
    expect(
      summarizeChange(
        change(
          "update",
          row({ occurred_at: "2026-11-27T00:00:00+00:00", note: "a" }),
          row({ occurred_at: "2026-11-27T00:00:00Z", note: "b" }),
        ),
      ),
    ).toEqual({ kind: "edited", fields: ["note"] });
  });

  it("an edit with nothing it knows how to name is 'other'", () => {
    expect(summarizeChange(change("update", row(), row({ account_id: "acc-2" })))).toEqual({
      kind: "edited",
      fields: ["other"],
    });
  });
});
