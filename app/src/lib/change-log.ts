import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Reading change_log — the before/after the database keeps for every
 * write to transactions (see the 2026-11-24 migration and
 * audit-context.ts for how the who and the screen get there).
 */

/** The part of a transactions row the history needs. */
export type TxSnapshot = {
  amount: number;
  kind: "income" | "expense";
  note: string | null;
  category_id: string | null;
  occurred_at: string;
  deleted_at: string | null;
  skipped: boolean;
  recurring_id: string | null;
};

export type ChangeRecord = {
  id: number;
  op: "insert" | "update" | "delete";
  changedAt: string;
  actorId: string | null;
  via: string | null;
  before: TxSnapshot | null;
  after: TxSnapshot | null;
};

/** What a change did, in the terms a person would say it. An amount of
 *  null is a month marked "-" (skipped): it has no figure. */
export type ChangeSummary =
  | { kind: "added"; amount: number | null }
  | { kind: "amount"; from: number | null; to: number | null }
  | { kind: "deleted"; amount: number | null }
  | { kind: "restored"; amount: number | null }
  | { kind: "edited"; fields: EditedField[] };

export type EditedField = "note" | "category" | "date" | "kind" | "other";

export function toSnapshot(row: unknown): TxSnapshot | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    amount: Number(r.amount),
    kind: r.kind === "income" ? "income" : "expense",
    note: typeof r.note === "string" ? r.note : null,
    category_id: typeof r.category_id === "string" ? r.category_id : null,
    occurred_at: String(r.occurred_at ?? ""),
    deleted_at: typeof r.deleted_at === "string" ? r.deleted_at : null,
    skipped: r.skipped === true,
    recurring_id: typeof r.recurring_id === "string" ? r.recurring_id : null,
  };
}

/** The figure a row shows: its amount, or null when it reads "-". */
function figure(s: TxSnapshot): number | null {
  return s.skipped ? null : s.amount;
}

export function summarizeChange(c: ChangeRecord): ChangeSummary {
  const { before, after } = c;
  if (c.op === "insert" && after) return { kind: "added", amount: figure(after) };
  if (c.op === "delete" && before) return { kind: "deleted", amount: figure(before) };
  if (!before || !after) return { kind: "edited", fields: ["other"] };

  // The app deletes by stamping deleted_at, so a delete arrives here as
  // an update. Undo clears it again.
  if (!before.deleted_at && after.deleted_at) {
    return { kind: "deleted", amount: figure(before) };
  }
  if (before.deleted_at && !after.deleted_at) {
    return { kind: "restored", amount: figure(after) };
  }
  if (figure(before) !== figure(after)) {
    return { kind: "amount", from: figure(before), to: figure(after) };
  }

  const fields: EditedField[] = [];
  if ((before.note ?? "") !== (after.note ?? "")) fields.push("note");
  if (before.category_id !== after.category_id) fields.push("category");
  if (Date.parse(before.occurred_at) !== Date.parse(after.occurred_at)) fields.push("date");
  if (before.kind !== after.kind) fields.push("kind");
  return { kind: "edited", fields: fields.length ? fields : ["other"] };
}

/**
 * Changes to the transactions of one ledger whose date falls in
 * [from, to), newest first.
 *
 * Returns [] rather than throwing when change_log can't be read — the
 * page it sits on should still render if the table isn't there yet
 * (a deploy that lands before the migration).
 */
export async function listTxChanges(input: {
  ledgerId: string;
  from: string;
  to: string;
  limit: number;
}): Promise<ChangeRecord[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("change_log")
    .select("id, op, changed_at, actor_id, via, old_row, new_row")
    .eq("table_name", "transactions")
    .eq("ledger_id", input.ledgerId)
    .gte("occurred_at", input.from)
    .lt("occurred_at", input.to)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit);
  if (error) {
    console.warn("[change-log] read failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    op: r.op as ChangeRecord["op"],
    changedAt: r.changed_at as string,
    actorId: (r.actor_id as string | null) ?? null,
    via: (r.via as string | null) ?? null,
    before: toSnapshot(r.old_row),
    after: toSnapshot(r.new_row),
  }));
}

/** users.id → the name to show (falls back to the e-mail's local part). */
export async function actorNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return names;
  const sb = getServerSupabase();
  const { data, error } = await sb.from("users").select("id, name, email").in("id", unique);
  if (error) {
    console.warn("[change-log] names failed:", error.message);
    return names;
  }
  for (const u of data ?? []) {
    const name = (u.name as string | null)?.trim() || (u.email as string | null)?.split("@")[0];
    if (name) names.set(u.id as string, name);
  }
  return names;
}
