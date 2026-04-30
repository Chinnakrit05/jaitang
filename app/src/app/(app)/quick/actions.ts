"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, assertWritable } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { createTransaction } from "@/lib/transactions";
import { parseQuickText, type QuickParseResult } from "@/lib/quick-parser";
import { getServerSupabase } from "@/lib/supabase/server";

const Schema = z.object({
  text: z.string().min(1).max(500),
});

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/quick");
}

export type QuickAddResponse =
  | {
      ok: true;
      txId: string;
      amount: number;
      kind: "income" | "expense";
      categoryName: string | null;
      categoryIcon: string | null;
      note: string | null;
      confidence: QuickParseResult["confidence"];
    }
  | { ok: false; error: string; needAmount?: boolean; parsed?: QuickParseResult };

export async function quickAddAction(formData: FormData): Promise<QuickAddResponse> {
  const { ledgerId, userId, role } = await requireSession();
  assertWritable(role);

  const parsed = Schema.safeParse({ text: formData.get("text") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let result: QuickParseResult;
  try {
    const categories = await listCategories(ledgerId);
    result = await parseQuickText(parsed.data.text, categories);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ไม่สามารถตีความได้",
    };
  }

  if (!result.amount) {
    return {
      ok: false,
      error: "ไม่เจอจำนวนเงิน — กรุณาระบุจำนวนให้ชัด เช่น '30 bts' หรือ 'กาแฟ 65'",
      needAmount: true,
      parsed: result,
    };
  }

  const occurredAt = result.occurredAt
    ? new Date(result.occurredAt).toISOString()
    : new Date().toISOString();

  const tx = await createTransaction({
    ledgerId,
    userId,
    categoryId: result.categoryId,
    kind: result.kind,
    amount: result.amount,
    note: result.note ?? undefined,
    occurredAt,
  });

  // Resolve category for display
  let categoryName: string | null = null;
  let categoryIcon: string | null = null;
  if (result.categoryId) {
    const sb = getServerSupabase();
    const { data: cat } = await sb
      .from("categories")
      .select("name, icon")
      .eq("id", result.categoryId)
      .maybeSingle();
    if (cat) {
      categoryName = cat.name;
      categoryIcon = cat.icon;
    }
  }

  refresh();
  return {
    ok: true,
    txId: tx.id,
    amount: result.amount,
    kind: result.kind,
    categoryName,
    categoryIcon,
    note: result.note,
    confidence: result.confidence,
  };
}
