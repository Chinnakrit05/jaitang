"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, assertWritable } from "@/lib/session";
import {
  addRepayment,
  createLoan,
  deleteLoan,
  deleteRepayment,
  setLoanStatus,
  updateLoan,
} from "@/lib/loans";
import { SUPPORTED_CODES } from "@/lib/currencies";

function refresh() {
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

const CreateLoanSchema = z.object({
  kind: z.enum(["lent", "borrowed"]),
  counterparty: z.string().min(1).max(120),
  principal: z.coerce.number().positive().max(1e10),
  currency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency"),
  startedAt: z.iso.datetime({ offset: true }),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().max(500).optional(),
});

export async function createLoanAction(formData: FormData) {
  const { ledgerId, userId, role } = await requireSession();
  assertWritable(role);

  const parsed = CreateLoanSchema.safeParse({
    kind: formData.get("kind"),
    counterparty: formData.get("counterparty"),
    principal: formData.get("principal"),
    currency: formData.get("currency"),
    startedAt: formData.get("startedAt"),
    dueDate: formData.get("dueDate") || null,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const loan = await createLoan({
    ledgerId,
    userId,
    kind: parsed.data.kind,
    counterparty: parsed.data.counterparty.trim(),
    principal: parsed.data.principal,
    currency: parsed.data.currency,
    startedAt: new Date(parsed.data.startedAt),
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    note: parsed.data.note ?? null,
  });
  refresh();
  redirect(`/loans/${loan.id}`);
}

const UpdateLoanSchema = CreateLoanSchema.partial();

export async function updateLoanAction(
  loanId: string,
  formData: FormData
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = UpdateLoanSchema.safeParse({
    kind: formData.get("kind") || undefined,
    counterparty: formData.get("counterparty") || undefined,
    principal: formData.get("principal") || undefined,
    currency: formData.get("currency") || undefined,
    startedAt: formData.get("startedAt") || undefined,
    dueDate: formData.get("dueDate") || null,
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await updateLoan(loanId, ledgerId, {
    kind: parsed.data.kind,
    counterparty: parsed.data.counterparty?.trim(),
    principal: parsed.data.principal,
    currency: parsed.data.currency,
    startedAt: parsed.data.startedAt
      ? new Date(parsed.data.startedAt)
      : undefined,
    dueDate:
      parsed.data.dueDate === undefined
        ? undefined
        : parsed.data.dueDate
        ? new Date(parsed.data.dueDate)
        : null,
    note: parsed.data.note ?? null,
  });
  refresh();
  return { ok: true as const };
}

export async function deleteLoanAction(loanId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteLoan(loanId, ledgerId);
  refresh();
  redirect("/loans");
}

const RepaymentSchema = z.object({
  amount: z.coerce.number().positive().max(1e10),
  occurredAt: z.iso.datetime({ offset: true }),
  note: z.string().max(500).optional(),
});

export async function addRepaymentAction(
  loanId: string,
  formData: FormData
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = RepaymentSchema.safeParse({
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await addRepayment({
    loanId,
    ledgerId,
    amount: parsed.data.amount,
    occurredAt: new Date(parsed.data.occurredAt),
    note: parsed.data.note ?? null,
  });
  refresh();
  return { ok: true as const };
}

export async function deleteRepaymentAction(repaymentId: string) {
  const { role } = await requireSession();
  assertWritable(role);
  await deleteRepayment(repaymentId);
  refresh();
}

export async function settleLoanAction(loanId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await setLoanStatus(loanId, ledgerId, "settled");
  refresh();
}

export async function reopenLoanAction(loanId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await setLoanStatus(loanId, ledgerId, "open");
  refresh();
}
