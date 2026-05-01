/**
 * Pure role-permission helpers, extracted out of `session.ts` so they can
 * be imported (and unit-tested) without dragging next-auth's runtime in.
 */

export type LedgerRole = "owner" | "editor" | "viewer";

export function assertWritable(role: LedgerRole) {
  if (role === "viewer") {
    throw new Error("คุณไม่มีสิทธิ์แก้ไขสมุดเล่มนี้ (viewer only)");
  }
}

export function assertOwner(role: LedgerRole) {
  if (role !== "owner") {
    throw new Error("เฉพาะเจ้าของสมุดเท่านั้นที่ทำการนี้ได้");
  }
}
