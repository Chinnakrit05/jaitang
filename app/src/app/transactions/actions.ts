"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/transactions";

const TxSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0").max(1e12),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  occurredAt: z.string().min(1),
});

function refreshAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function createTransactionAction(formData: FormData) {
  const { userId, ledgerId } = await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createTransaction({
    ledgerId,
    userId,
    categoryId: parsed.data.categoryId ?? null,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    note: parsed.data.note,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  refreshAll();
  redirect("/transactions");
}

export async function updateTransactionAction(id: string, formData: FormData) {
  await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await updateTransaction(id, {
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    categoryId: parsed.data.categoryId ?? null,
    note: parsed.data.note ?? null,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  refreshAll();
  redirect("/transactions");
}

export async function deleteTransactionAction(id: string) {
  await requireSession();
  await deleteTransaction(id);
  refreshAll();
}
