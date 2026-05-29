"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession, assertWritable } from "@/lib/session";
import { createTransaction } from "@/lib/transactions";

/**
 * Image → line-item import for the monthly report. The user snaps (or
 * uploads) a picture of a bill / spreadsheet / hand-written list and we
 * use Claude vision to pull out a flat list of {name, amount, kind}
 * rows. Nothing is written here — the parsed rows go back to the client
 * for a preview/confirm pass (OCR mis-reads happen, and a wrong amount
 * in someone's ledger is worse than an extra tap). The commit step
 * below is what actually materialises the transactions, all stamped to
 * the viewed month so "import on month X lands in month X" holds.
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — phone screenshots sit well under this
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

export type ParsedRow = {
  name: string;
  amount: number;
  kind: "income" | "expense";
};

const RowSchema = z.object({
  name: z.string().max(200),
  amount: z.coerce.number().positive().max(1e12),
  kind: z.enum(["income", "expense"]),
});

/**
 * Read an image and return the line items found in it. Throws on a
 * missing API key so the caller can show a clear "AI not configured"
 * message rather than a generic failure.
 */
export async function parseReportImageAction(
  formData: FormData
): Promise<
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; error: string }
> {
  const { role } = await requireSession();
  assertWritable(role);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ไม่พบไฟล์รูป" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "ไฟล์ใหญ่เกินไป (จำกัด 8MB)" };
  }
  const mediaType = file.type as AllowedMedia;
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return { ok: false, error: "รองรับเฉพาะไฟล์รูป (JPG / PNG / WebP)" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า AI (ANTHROPIC_API_KEY)" };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You extract financial line items from an image of a bill, receipt, spreadsheet, or hand-written money list.

Return ONLY a JSON array — no prose, no markdown fences. Each element:
{"name": string, "amount": number, "kind": "income" | "expense"}

Rules:
- One element per line item / row that has a money amount.
- "amount" is a positive number with NO currency symbol, NO thousands separators (e.g. 6607, not "฿6,607").
- "name" is the item label exactly as written (keep the original language, e.g. Thai). Trim surrounding whitespace.
- "kind": default to "expense". Only use "income" when the row is clearly money coming in (เงินเข้า, รายรับ, เงินเดือน, salary, refund, ยอดโอนเข้า).
- Skip header rows, section titles, subtotals, grand totals, and any line without a clear amount.
- If you cannot read any line items, return [].`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Extract every line item with its amount as the JSON array described.",
            },
          ],
        },
      ],
    });
  } catch {
    return { ok: false, error: "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  const block = response.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  // The model is told to return bare JSON, but strip a stray ```json
  // fence just in case so one bad wrap doesn't sink the whole import.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "อ่านรายการจากรูปไม่ได้ ลองถ่ายให้ชัดขึ้น" };
  }

  const arr = Array.isArray(parsed) ? parsed : [];
  const rows: ParsedRow[] = [];
  for (const item of arr) {
    const r = RowSchema.safeParse(item);
    if (r.success && r.data.name.trim().length > 0) {
      rows.push({
        name: r.data.name.trim(),
        amount: r.data.amount,
        kind: r.data.kind,
      });
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "ไม่พบรายการในรูป ลองถ่ายให้ชัดขึ้น" };
  }
  return { ok: true, rows };
}

/**
 * Commit the (possibly user-edited) rows into the viewed month. Mirrors
 * createReportTransactionAction: each tx lands at Bangkok noon on day 1
 * of the month so it falls inside the report's UTC range filter and
 * shows up immediately, with no category ("ไม่ระบุ"). The item name
 * flows into the note.
 */
const CommitSchema = z.object({
  year: z.coerce.number().int().min(1970).max(2999),
  month: z.coerce.number().int().min(1).max(12),
  rows: z.array(RowSchema).min(1).max(200),
});

export async function commitImportedTransactionsAction(input: {
  year: number;
  month: number;
  rows: ParsedRow[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { userId, ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = CommitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const { year, month, rows } = parsed.data;
  const mm = String(month).padStart(2, "0");
  const occurredAt = new Date(`${year}-${mm}-01T12:00:00+07:00`).toISOString();

  // Insert sequentially — these batches are small (a bill's worth of
  // rows) and createTransaction throws on error, so a failure surfaces
  // with however many already landed rather than silently dropping.
  let count = 0;
  for (const row of rows) {
    const note = row.name.trim();
    await createTransaction({
      ledgerId,
      userId,
      categoryId: null,
      tripId: null,
      accountId: null,
      kind: row.kind,
      amount: row.amount,
      note: note.length > 0 ? note : undefined,
      occurredAt,
    });
    count += 1;
  }

  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true, count };
}
