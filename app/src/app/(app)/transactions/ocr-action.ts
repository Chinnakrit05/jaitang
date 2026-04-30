"use server";

import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { parseReceipt, type ParsedReceipt } from "@/lib/ocr";

export async function parseReceiptAction(
  imageDataUrl: string
): Promise<
  | { ok: true; result: ParsedReceipt }
  | { ok: false; error: string }
> {
  try {
    const { ledgerId } = await requireSession();
    const categories = await listCategories(ledgerId);
    const result = await parseReceipt(imageDataUrl, categories);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "ไม่สามารถอ่านใบเสร็จได้";
    return { ok: false, error: message };
  }
}
