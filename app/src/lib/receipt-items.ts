import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";

/** One line on the receipt, already assigned a category by the model. */
export type ReceiptLineItem = {
  name: string;
  amount: number;
  categoryId: string | null;
};

export type ParsedReceiptItems = {
  merchant: string | null;
  occurredAt: string | null;
  kind: TxKind;
  paymentMethod: PaymentMethod | null;
  items: ReceiptLineItem[];
  /** Printed grand total, when the document shows one. Kept separate
   *  from the item sum so the caller can flag a mismatch instead of
   *  silently trusting either number. */
  total: number | null;
  confidence: "high" | "medium" | "low";
};

/** A category's worth of items, collapsed into the single transaction
 *  they will be saved as. */
export type ReceiptGroup<T extends ReceiptLineItem = ReceiptLineItem> = {
  categoryId: string | null;
  amount: number;
  items: T[];
};

const LineItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  categoryId: z.string().nullable(),
});

const ReceiptItemsSchema = z.object({
  merchant: z.string().nullable(),
  occurredAt: z.string().nullable(),
  kind: z.enum(["income", "expense"]),
  paymentMethod: z.enum(["cash", "transfer"]).nullable(),
  items: z.array(LineItemSchema),
  total: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

/** Bucket key for items the model could not place. A space prefix keeps
 *  it clear of any real uuid. */
const UNCATEGORIZED = " uncategorized";

/**
 * Collapse line items into one entry per category — the shape the user
 * actually wants in their ledger. A supermarket run that touched four
 * categories becomes four transactions, not forty.
 *
 * Order follows first appearance on the receipt so the review modal
 * reads top-to-bottom like the paper does. Uncategorized items collect
 * into their own group rather than being dropped; the modal makes the
 * user deal with them.
 */
export function groupItemsByCategory<T extends ReceiptLineItem>(
  items: T[]
): ReceiptGroup<T>[] {
  // Generic so a caller that carries extra per-item state (the review
  // modal tracks a key and an included flag) gets it back intact
  // instead of casting.
  const groups = new Map<string, ReceiptGroup<T>>();
  for (const item of items) {
    // Map keys must be strings; null is a real bucket, not an absence.
    const key = item.categoryId ?? UNCATEGORIZED;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += item.amount;
      existing.items.push(item);
    } else {
      groups.set(key, {
        categoryId: item.categoryId,
        amount: item.amount,
        items: [item],
      });
    }
  }
  // Round once at the end — summing 0.1-style values in a loop drifts.
  return [...groups.values()].map((g) => ({
    ...g,
    amount: Math.round(g.amount * 100) / 100,
  }));
}

/**
 * Note for one saved transaction: shop name plus what went into it, so
 * the row still means something in the ledger a month later.
 *
 * Capped at the 500 the server accepts — a forty-line grocery run
 * should arrive shortened, not rejected.
 */
export function composeReceiptNote(
  merchant: string | null,
  items: ReceiptLineItem[]
): string {
  const names = items.map((i) => i.name).filter(Boolean).join(", ");
  const full = merchant ? (names ? `${merchant}: ${names}` : merchant) : names;
  return full.length > 500 ? `${full.slice(0, 497)}...` : full;
}

/**
 * Read a receipt or slip into individual line items, each tagged with a
 * category.
 *
 * This is the multi-item counterpart to `parseReceipt` in ocr.ts, which
 * returns a single transaction and remains the right call for a plain
 * transfer slip. Splitting a shopping receipt correctly is a harder
 * problem than reading one total — item names are abbreviated, prices
 * sit in columns, and discount and VAT lines must not become
 * transactions — so this path runs on a stronger model.
 */
export async function parseReceiptLineItems(
  imageDataUrl: string,
  categories: Category[]
): Promise<ParsedReceiptItems> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ฟีเจอร์ OCR ต้องการ ANTHROPIC_API_KEY — ดู SETUP.md สำหรับวิธีตั้งค่า"
    );
  }

  const match = imageDataUrl.match(
    /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/
  );
  if (!match) {
    throw new Error("รูปภาพต้องเป็น PNG/JPEG/WebP/GIF");
  }
  const mediaType = (match[1] === "image/jpg" ? "image/jpeg" : match[1]) as
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "image/gif";
  const data = match[3];

  const catList = categories
    .map((c) => `- ${c.id} | ${c.kind} | ${c.icon ?? "✨"} ${c.name}`)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      // Reading columns off a crumpled photo benefits from some
      // thinking, but this is extraction rather than reasoning and the
      // user is watching a spinner on their phone. Raise to "high" if
      // item splitting turns out to be the weak link.
      effort: "medium",
      format: zodOutputFormat(ReceiptItemsSchema),
    },
    system: `You split a financial document image into individual line items and assign each one a category.

The image is either:
A) A retail RECEIPT (supermarket, pet shop, restaurant, pharmacy) - a list of items with prices, merchant name on top, a grand total at the bottom.
B) A bank/PromptPay TRANSFER SLIP - one amount, sender to receiver, reference number. A slip has exactly one line item: the transfer itself.

Rules for "items":
- One entry per purchased thing. Use the printed item name, tidied up - expand obvious abbreviations, keep the original language.
- "amount" is that line's own total (quantity already multiplied in), in THB.
- NEVER emit a line for: subtotals, the grand total, VAT/tax lines, discounts, change, loyalty points, or payment-method lines. Those are not purchases.
- If a discount applies to a specific item, subtract it from that item's amount rather than making a separate entry.
- Assign every item the categoryId whose label best fits it. Items from the same shop often belong to different categories - a supermarket run can be food, household, and pet supplies at once. Judge each item on its own.
- Use null for categoryId only when no category is a reasonable fit.

"total" is the grand total printed on the document, or null if none is shown.
"kind": receipts are "expense". Slips are "expense" if the user is the sender (most common), "income" if the receiver.
"paymentMethod": "transfer" for a bank/PromptPay slip, "cash" for a paper retail receipt.
"occurredAt": local time printed on the document, "YYYY-MM-DDTHH:MM:SS".
"merchant": shop or counterparty name.

Today is ${today}. If the document has no year, assume the current year. Thai dates may use the Buddhist year (e.g. 2568) - convert to Gregorian by subtracting 543.

Available categories (id | kind | label):
${catList}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data },
          },
          {
            type: "text",
            text: "Split this document into line items with categories.",
          },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("อ่านรายการจากรูปไม่สำเร็จ ลองถ่ายใหม่ให้ชัดขึ้น");
  }

  // The schema guarantees the shape; it cannot guarantee the model
  // stayed inside the category list, or that every amount is sane.
  const validIds = new Set(categories.map((c) => c.id));
  const items: ReceiptLineItem[] = parsed.items
    .filter((i) => typeof i.amount === "number" && i.amount > 0)
    .map((i) => ({
      name: i.name.trim(),
      amount: Math.round(i.amount * 100) / 100,
      categoryId:
        i.categoryId && validIds.has(i.categoryId) ? i.categoryId : null,
    }));

  return {
    merchant: parsed.merchant?.trim() || null,
    occurredAt: parsed.occurredAt || null,
    kind: parsed.kind === "income" ? "income" : "expense",
    paymentMethod: parsed.paymentMethod ?? null,
    items,
    total:
      typeof parsed.total === "number" && parsed.total > 0
        ? parsed.total
        : null,
    confidence: parsed.confidence,
  };
}
