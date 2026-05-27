"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, assertWritable } from "@/lib/session";
import {
  createRecurring,
  deleteRecurring,
  setRecurringActive,
  updateRecurring,
  applyDueRecurring,
  fillPendingRecurring,
} from "@/lib/recurring";
import { SUPPORTED_CODES } from "@/lib/currencies";

const Schema = z.object({
  kind: z.enum(["income", "expense"]),
  // Nullable so a user can set up a variable-cost rule (ค่าไฟ ค่าน้ำ) without
  // committing to an amount up front. Empty form input → null in DB.
  amount: z.coerce.number().positive().max(1e10).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  tripId: z.string().uuid().nullable().optional(),
  fxCurrency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
    .nullable()
    .optional(),
  note: z.string().max(500).optional(),
  period: z.enum(["daily", "weekly", "monthly", "yearly"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  // Same TZ-correctness reasoning as transactions.actions.ts — see comment
  // there. Form converts the wall-clock string to UTC ISO before submit.
  // Now optional: when the create form omits it, the server defaults
  // the start anchor based on the chosen period (start of this month /
  // year / week / today) — the user no longer needs to pick a date.
  startDate: z.iso.datetime({ offset: true }).optional(),
});

function refresh() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

/**
 * Sensible first-run anchor for a fresh rule when the user didn't
 * pick a date. Matches the natural read of the period choice:
 *
 *   daily   → today at this hour (rule is "live as of now")
 *   weekly  → start of this week (Monday)
 *   monthly → 1st of this month
 *   yearly  → Jan 1 of this year
 *
 * All anchored "now or in the recent past" so the rule shows as
 * applicable to the current period — variable bills surface as
 * pending immediately, fixed-amount rules let the cron pick the next
 * future occurrence via computeNextRun.
 */
function defaultStartForPeriod(
  period: "daily" | "weekly" | "monthly" | "yearly"
): Date {
  const now = new Date();
  switch (period) {
    case "daily":
      return now;
    case "weekly": {
      // ISO week — Monday-anchored.
      const dow = (now.getDay() + 6) % 7;
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - dow);
      return d;
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "yearly":
      return new Date(now.getFullYear(), 0, 1);
  }
}

export async function createRecurringAction(formData: FormData) {
  const { ledgerId, userId, role } = await requireSession();
  assertWritable(role);
  const parsed = Schema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount") || null,
    categoryId: formData.get("categoryId") || null,
    accountId: formData.get("accountId") || null,
    tripId: formData.get("tripId") || null,
    fxCurrency: formData.get("fxCurrency") || null,
    note: formData.get("note") || undefined,
    period: formData.get("period"),
    dayOfMonth: formData.get("dayOfMonth") || null,
    dayOfWeek: formData.get("dayOfWeek") || null,
    startDate: formData.get("startDate"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Period-aware default for when the form skips the date input.
  // The current calendar bucket gives the cron a sensible first
  // anchor that maps to "this month / this year" in the user's head.
  const start = parsed.data.startDate
    ? new Date(parsed.data.startDate)
    : defaultStartForPeriod(parsed.data.period);
  await createRecurring({
    ledgerId,
    userId,
    categoryId: parsed.data.categoryId ?? null,
    accountId: parsed.data.accountId ?? null,
    tripId: parsed.data.tripId ?? null,
    fxCurrency: parsed.data.fxCurrency ?? null,
    kind: parsed.data.kind,
    amount: parsed.data.amount ?? null,
    note: parsed.data.note ?? null,
    period: parsed.data.period,
    dayOfMonth:
      parsed.data.period === "monthly"
        ? parsed.data.dayOfMonth ?? start.getDate()
        : null,
    dayOfWeek:
      parsed.data.period === "weekly"
        ? parsed.data.dayOfWeek ?? start.getDay()
        : null,
    nextRunAt: start,
  });
  refresh();
  redirect("/recurring");
}

const UpdateSchema = Schema.partial().extend({
  // Make startDate optional on update
  startDate: z.iso.datetime({ offset: true }).optional(),
});

export async function updateRecurringAction(id: string, formData: FormData) {
  const { role } = await requireSession();
  assertWritable(role);

  // For updates, "amount" is null when blank (variable-cost rule), and a
  // positive number when the user filled it in. The Zod schema is fine with
  // both via `.nullable().optional()`.
  const rawAmount = formData.get("amount");
  const parsed = UpdateSchema.safeParse({
    kind: formData.get("kind") || undefined,
    amount: rawAmount === "" || rawAmount === null ? null : rawAmount,
    categoryId: formData.get("categoryId") || null,
    accountId: formData.get("accountId") || null,
    tripId: formData.get("tripId") || null,
    fxCurrency: formData.get("fxCurrency") || null,
    note: formData.get("note") || undefined,
    period: formData.get("period") || undefined,
    dayOfMonth: formData.get("dayOfMonth") || null,
    dayOfWeek: formData.get("dayOfWeek") || null,
    startDate: formData.get("startDate") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await updateRecurring(id, {
    categoryId: parsed.data.categoryId ?? null,
    accountId: parsed.data.accountId ?? null,
    tripId: parsed.data.tripId ?? null,
    fxCurrency: parsed.data.fxCurrency ?? null,
    kind: parsed.data.kind,
    amount: parsed.data.amount ?? null,
    note: parsed.data.note ?? null,
    period: parsed.data.period,
    nextRunAt: parsed.data.startDate
      ? new Date(parsed.data.startDate)
      : undefined,
  });
  refresh();
  return { ok: true as const };
}

export async function deleteRecurringAction(id: string) {
  const { role } = await requireSession();
  assertWritable(role);
  await deleteRecurring(id);
  refresh();
}

export async function toggleRecurringAction(id: string, active: boolean) {
  const { role } = await requireSession();
  assertWritable(role);
  await setRecurringActive(id, active);
  refresh();
}

export async function runDueAction() {
  const { ledgerId } = await requireSession();
  const created = await applyDueRecurring(ledgerId);
  refresh();
  return { created };
}

const FillSchema = z.object({
  amount: z.coerce.number().positive().max(1e10),
});

export async function fillPendingRecurringAction(
  ruleId: string,
  formData: FormData,
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  const parsed = FillSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  await fillPendingRecurring({
    ruleId,
    ledgerId,
    amount: parsed.data.amount,
  });
  refresh();
  return { ok: true as const };
}

/**
 * Lightweight wrapper around `fillPendingRecurring` for the inline
 * amount field on the recurring list — same path as the pending
 * panel, just a friendlier signature (no FormData) so the client
 * component can call it directly from <InlineAmount>.
 */
export async function fillPendingRecurringAmountAction(
  ruleId: string,
  amount: number,
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  const parsed = FillSchema.safeParse({ amount });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  await fillPendingRecurring({
    ruleId,
    ledgerId,
    amount: parsed.data.amount,
  });
  refresh();
  return { ok: true as const };
}
