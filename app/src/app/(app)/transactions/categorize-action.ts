"use server";

import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { suggestCategory } from "@/lib/categorize-ai";
import type { TxKind } from "@/lib/types";

/**
 * Server action wrapper around `suggestCategory`. Re-fetches the
 * ledger's categories so the model can only suggest from the user's
 * actual list (defense against stale client data).
 */
export async function suggestCategoryAction(input: {
  note: string;
  kind: TxKind;
}): Promise<
  | { ok: true; categoryId: string | null; confidence: "high" | "medium" | "low" }
  | { ok: false; error: string }
> {
  const { ledgerId } = await requireSession();

  if (input.kind !== "income" && input.kind !== "expense") {
    return { ok: false, error: "Invalid kind" };
  }
  if (typeof input.note !== "string" || input.note.trim().length === 0) {
    return { ok: false, error: "Empty note" };
  }
  if (input.note.length > 500) {
    return { ok: false, error: "Note too long" };
  }

  try {
    const categories = await listCategories(ledgerId);
    const result = await suggestCategory(input.note, input.kind, categories);
    if (!result) {
      return {
        ok: false,
        error: "AI suggestion not configured (ANTHROPIC_API_KEY missing).",
      };
    }
    return {
      ok: true,
      categoryId: result.categoryId,
      confidence: result.confidence,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Suggestion failed",
    };
  }
}
