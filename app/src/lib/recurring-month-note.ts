/** Notes a recurring rule carries per month, keyed "YYYY-MM". */
export type MonthNotes = Record<string, string>;

/** The key a note is filed under. Zero-padded so string sort is date
 *  sort, and so it matches the `ym` the reports page already passes
 *  around in its query string. */
export function monthNoteKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Whatever came back from the jsonb column, as notes we can trust.
 *
 * The column is `jsonb` with no shape enforced, and old rows predate
 * it entirely, so anything that isn't a string entry in an object is
 * dropped rather than rendered.
 */
export function readMonthNotes(value: unknown): MonthNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: MonthNotes = {};
  for (const [key, note] of Object.entries(value as Record<string, unknown>)) {
    if (typeof note === "string" && note.trim()) out[key] = note;
  }
  return out;
}

/**
 * The notes object to write back after editing one month.
 *
 * Clearing a note removes the key instead of storing "" — an empty
 * string would make `Object.keys` lie about which months are annotated,
 * and the UI reads exactly that to decide whether to show a chip.
 *
 * Returns a new object; the input is never mutated, so a failed write
 * leaves the caller's copy intact.
 */
export function mergeMonthNote(
  notes: MonthNotes,
  key: string,
  note: string
): MonthNotes {
  const next = { ...notes };
  const trimmed = note.trim();
  if (trimmed) next[key] = trimmed;
  else delete next[key];
  return next;
}
