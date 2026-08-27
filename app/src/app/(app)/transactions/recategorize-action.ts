"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listTransactions, updateTransaction } from "@/lib/transactions";
import { proposeRecategorization } from "@/lib/recategorize-ai";

/** One proposed move, carrying everything the review sheet needs to
 *  render a row without a second round-trip. */
export type RecategorizeChange = {
  txId: string;
  note: string | null;
  amount: number;
  occurredAt: string;
  fromName: string | null;
  fromIcon: string | null;
  toId: string;
  toName: string;
  toIcon: string | null;
  confidence: "high" | "medium";
};

/** Same UTC bounds the transactions page uses for a `ym`, so the set
 *  reviewed is exactly the set on screen. */
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    to: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

const YmSchema = z.string().regex(/^\d{4}-\d{2}$/, "Invalid month");

export async function proposeRecategorizeAction(
  ym: string
): Promise<
  | { ok: true; changes: RecategorizeChange[]; scanned: number }
  | { ok: false; error: string }
> {
  const parsedYm = YmSchema.safeParse(ym);
  if (!parsedYm.success) return { ok: false as const, error: "Invalid month" };
  // Outside the try on purpose: this throws Next's redirect when there
  // is no session, and catching it would render "NEXT_REDIRECT" as an
  // error message instead of sending the user to log in.
  const { ledgerId } = await requireSession();

  try {
    const { from, to } = monthBounds(parsedYm.data);

    const [items, categories] = await Promise.all([
      listTransactions({ ledgerId, from, to, limit: 500 }),
      listCategories(ledgerId),
    ]);
    if (items.length === 0) {
      return { ok: true as const, changes: [], scanned: 0 };
    }

    const proposals = await proposeRecategorization(items, categories);
    const txById = new Map(items.map((tx) => [tx.id, tx]));
    const catById = new Map(categories.map((c) => [c.id, c]));

    const changes: RecategorizeChange[] = [];
    for (const p of proposals) {
      const tx = txById.get(p.txId);
      const target = catById.get(p.categoryId);
      if (!tx || !target) continue;
      changes.push({
        txId: tx.id,
        note: tx.note,
        amount: tx.amount,
        occurredAt: tx.occurred_at,
        fromName: tx.category?.name ?? null,
        fromIcon: tx.category?.icon ?? null,
        toId: target.id,
        toName: target.name,
        toIcon: target.icon,
        confidence: p.confidence,
      });
    }
    return { ok: true as const, changes, scanned: items.length };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "วิเคราะห์หมวดหมู่ไม่สำเร็จ";
    return { ok: false as const, error: message };
  }
}

const ApplySchema = z.object({
  changes: z
    .array(
      z.object({
        txId: z.string().uuid(),
        toId: z.string().uuid(),
      })
    )
    .min(1)
    .max(500),
});

/**
 * Write the moves the user kept.
 *
 * Sequential rather than parallel for the same reason as the receipt
 * import: on a partial failure the count that comes back is the count
 * that actually landed, instead of leaving the user to guess which of
 * fifty writes went through.
 */
export async function applyRecategorizeAction(
  changes: Array<{ txId: string; toId: string }>
): Promise<
  { ok: true; applied: number } | { ok: false; error: string; applied: number }
> {
  const { ledgerId } = await requireSession();
  const parsed = ApplySchema.safeParse({ changes });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      applied: 0,
    };
  }

  // The payload came back from a client component, so neither id can be
  // taken on trust: a category from another ledger, or a transaction
  // that is not the caller's, would otherwise be written verbatim.
  const validCategoryIds = new Set(
    (await listCategories(ledgerId)).map((c) => c.id)
  );
  const ledgerTxIds = new Set(
    (await listTransactions({ ledgerId, limit: 5000 })).map((tx) => tx.id)
  );
  for (const c of parsed.data.changes) {
    if (!validCategoryIds.has(c.toId) || !ledgerTxIds.has(c.txId)) {
      return { ok: false as const, error: "ข้อมูลไม่ถูกต้อง", applied: 0 };
    }
  }

  let applied = 0;
  try {
    for (const c of parsed.data.changes) {
      await updateTransaction(c.txId, { categoryId: c.toId });
      applied++;
    }
  } catch (err) {
    revalidatePath("/transactions");
    const message =
      err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    return { ok: false as const, error: message, applied };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/insights");
  return { ok: true as const, applied };
}
