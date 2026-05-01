"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, assertWritable } from "@/lib/session";
import {
  createRecurring,
  deleteRecurring,
  setRecurringActive,
  applyDueRecurring,
} from "@/lib/recurring";

const Schema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive().max(1e10),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  period: z.enum(["daily", "weekly", "monthly"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  // Same TZ-correctness reasoning as transactions.actions.ts — see comment
  // there. Form converts the wall-clock string to UTC ISO before submit.
  startDate: z.iso.datetime({ offset: true }),
});

function refresh() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function createRecurringAction(formData: FormData) {
  const { ledgerId, userId, role } = await requireSession();
  assertWritable(role);
  const parsed = Schema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    period: formData.get("period"),
    dayOfMonth: formData.get("dayOfMonth") || null,
    dayOfWeek: formData.get("dayOfWeek") || null,
    startDate: formData.get("startDate"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const start = new Date(parsed.data.startDate);
  await createRecurring({
    ledgerId,
    userId,
    categoryId: parsed.data.categoryId ?? null,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
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
