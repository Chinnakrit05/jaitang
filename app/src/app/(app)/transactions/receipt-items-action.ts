"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { createTransaction } from "@/lib/transactions";
import {
  parseReceiptLineItems,
  type ParsedReceiptItems,
} from "@/lib/receipt-items";

/** Mirrors refreshAll() in ./actions.ts — a "use server" module can only
 *  export async functions, so the list can't be shared from there. Keep
 *  the two in step. */
function refreshAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/balances");
  revalidatePath("/accounts");
  revalidatePath("/reports");
}

export async function parseReceiptItemsAction(
  imageDataUrl: string
): Promise<
  { ok: true; result: ParsedReceiptItems } | { ok: false; error: string }
> {
  try {
    const { ledgerId } = await requireSession();
    const categories = await listCategories(ledgerId);
    const result = await parseReceiptLineItems(imageDataUrl, categories);
    return { ok: true, result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ไม่สามารถอ่านใบเสร็จได้";
    return { ok: false, error: message };
  }
}

const RowSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  amount: z.number().positive().max(1e10),
  note: z.string().max(500),
  kind: z.enum(["income", "expense"]),
  paymentMethod: z.enum(["cash", "transfer"]).nullable(),
});

const BulkSchema = z.object({
  // A till receipt has a handful of categories, not hundreds. The cap
  // is here so a mis-parse can't turn into a hundred writes.
  rows: z.array(RowSchema).min(1).max(40),
  occurredAt: z.iso.datetime({ offset: true }),
  tripId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
});

export type ReceiptRowInput = z.infer<typeof RowSchema>;

/**
 * Save the reviewed receipt as one transaction per category.
 *
 * Written sequentially rather than in parallel: a partial failure
 * halfway through a Promise.all leaves the user guessing which lines
 * landed. Here the count that comes back is the count that saved, and
 * the error names the row that stopped it.
 */
export async function createTransactionsFromReceiptAction(input: {
  rows: ReceiptRowInput[];
  occurredAt: string;
  tripId: string | null;
  accountId: string | null;
}): Promise<
  | { ok: true; created: number }
  | { ok: false; error: string; created: number }
> {
  const { userId, ledgerId } = await requireSession();
  const parsed = BulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      created: 0,
    };
  }

  // Categories are chosen client-side from a list we rendered, but the
  // payload is still user input — an id from another ledger would
  // otherwise be accepted verbatim.
  const validIds = new Set((await listCategories(ledgerId)).map((c) => c.id));
  for (const row of parsed.data.rows) {
    if (row.categoryId && !validIds.has(row.categoryId)) {
      return {
        ok: false as const,
        error: "หมวดหมู่ไม่ถูกต้อง",
        created: 0,
      };
    }
  }

  let created = 0;
  try {
    for (const row of parsed.data.rows) {
      await createTransaction({
        ledgerId,
        userId,
        categoryId: row.categoryId,
        tripId: parsed.data.tripId,
        accountId: parsed.data.accountId,
        kind: row.kind,
        amount: row.amount,
        note: row.note || undefined,
        paymentMethod: row.paymentMethod,
        occurredAt: parsed.data.occurredAt,
      });
      created++;
    }
  } catch (err) {
    refreshAll();
    const message =
      err instanceof Error ? err.message : "บันทึกรายการไม่สำเร็จ";
    return { ok: false as const, error: message, created };
  }

  refreshAll();
  return { ok: true as const, created };
}
