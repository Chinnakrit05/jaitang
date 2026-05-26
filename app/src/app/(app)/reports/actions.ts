"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession, assertWritable } from "@/lib/session";
import { updateTransaction } from "@/lib/transactions";
import { updateRecurring } from "@/lib/recurring";

const AmountSchema = z.coerce.number().positive().max(1e12);
const NoteSchema = z.string().max(500);

/**
 * Single-field amount update used by the inline-editable rows on the
 * monthly-report page. The full transaction edit screen still owns the
 * heavy form — this exists so the user can scrub through a month's
 * worth of bills without bouncing into / out of each row.
 *
 * NOTE: We deliberately don't re-resolve FX here. If the row is a
 * foreign-currency tx, the stored home-currency `amount` will drift
 * away from `fx_amount * fx_rate`. That's acceptable for a fast tweak;
 * the long form is where you'd correct the foreign-currency value
 * itself.
 */
export async function updateTransactionAmountAction(
  id: string,
  amount: number
) {
  const { role } = await requireSession();
  assertWritable(role);
  const parsed = AmountSchema.safeParse(amount);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  await updateTransaction(id, { amount: parsed.data });
  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Same as above but for an active recurring rule. Editing here updates
 * the *template* — future generated transactions will use the new
 * amount. Already-materialised rows aren't touched.
 */
export async function updateRecurringAmountAction(
  id: string,
  amount: number
) {
  const { role } = await requireSession();
  assertWritable(role);
  const parsed = AmountSchema.safeParse(amount);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  await updateRecurring(id, { amount: parsed.data });
  revalidatePath("/reports");
  revalidatePath("/recurring");
  return { ok: true as const };
}

/**
 * Inline note edit for a transaction row. Trim → empty string clears
 * the note (stored as NULL) so the row falls back to category name as
 * its primary line.
 */
export async function updateTransactionNoteAction(id: string, note: string) {
  const { role } = await requireSession();
  assertWritable(role);
  const parsed = NoteSchema.safeParse(note);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }
  const trimmed = parsed.data.trim();
  await updateTransaction(id, { note: trimmed.length === 0 ? null : trimmed });
  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Same as above for a recurring rule. */
export async function updateRecurringNoteAction(id: string, note: string) {
  const { role } = await requireSession();
  assertWritable(role);
  const parsed = NoteSchema.safeParse(note);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }
  const trimmed = parsed.data.trim();
  await updateRecurring(id, { note: trimmed.length === 0 ? null : trimmed });
  revalidatePath("/reports");
  revalidatePath("/recurring");
  return { ok: true as const };
}
