"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession, assertWritable } from "@/lib/session";
import { upsertBudget, deleteBudget } from "@/lib/budgets";

const Schema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().nonnegative().max(1e10),
});

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/categories");
  revalidatePath("/budgets");
}

export async function setBudgetAction(formData: FormData) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  const parsed = Schema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.amount === 0) {
    await deleteBudget({ ledgerId, categoryId: parsed.data.categoryId });
  } else {
    await upsertBudget({
      ledgerId,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
    });
  }
  refresh();
  return { ok: true as const };
}
