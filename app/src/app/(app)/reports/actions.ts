"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession, assertWritable } from "@/lib/session";
import { createTransaction, updateTransaction } from "@/lib/transactions";
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

/**
 * Quick-add a transaction directly from the monthly report. Inserted with
 * category_id = NULL (renders as "ไม่ระบุ") on the 1st of the viewed month
 * at Bangkok noon — that timestamp falls inside both UTC and Bangkok bounds
 * for the month, so the new row shows up on this report immediately. The
 * heavier full edit screen is where the user can assign a category, payment
 * method, etc. afterwards.
 */
const CreateReportTxSchema = z.object({
  kind: z.enum(["income", "expense"]),
  year: z.coerce.number().int().min(1970).max(2999),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().positive().max(1e12),
});

export async function createReportTransactionAction(input: {
  kind: "income" | "expense";
  year: number;
  month: number;
  amount: number;
}) {
  const { userId, ledgerId, role } = await requireSession();
  assertWritable(role);
  const parsed = CreateReportTxSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { kind, year, month, amount } = parsed.data;
  const mm = String(month).padStart(2, "0");
  // Bangkok noon on day 1 — falls inside the report's UTC range filter and
  // displays as the 1st regardless of viewer timezone.
  const occurredAt = `${year}-${mm}-01T12:00:00+07:00`;
  await createTransaction({
    ledgerId,
    userId,
    categoryId: null,
    tripId: null,
    accountId: null,
    kind,
    amount,
    occurredAt: new Date(occurredAt).toISOString(),
  });
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
