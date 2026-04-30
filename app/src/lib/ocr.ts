import Anthropic from "@anthropic-ai/sdk";
import type { Category, TxKind } from "@/lib/types";

export type ParsedReceipt = {
  amount: number | null;
  kind: TxKind;
  occurredAt: string | null; // ISO date or null if unknown
  note: string | null;
  categoryId: string | null;
  confidence: "high" | "medium" | "low";
  raw: string; // full assistant note for debugging
};

/**
 * Parse a receipt image into transaction-shaped fields using Claude Vision.
 * Returns null fields when uncertain so the form can still ask the user.
 *
 * Requires ANTHROPIC_API_KEY in env. Throws a friendly error if missing
 * so the caller can render a setup hint.
 */
export async function parseReceipt(
  imageDataUrl: string,
  categories: Category[]
): Promise<ParsedReceipt> {
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

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");
  const catList = [...expenseCats, ...incomeCats]
    .map((c) => `- ${c.id} | ${c.kind} | ${c.icon ?? "✨"} ${c.name}`)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `You parse a financial document image into a transaction. The image will be either:
A) A retail RECEIPT (cafe, supermarket, restaurant, etc.) — list of items + total, merchant name on top.
B) A bank/PromptPay TRANSFER SLIP — Thai banks (SCB, KBank, Bangkok Bank, KTB, BBL, Krungsri, TMB, etc.) or e-wallets (TrueMoney, ShopeePay, etc.). Shows transfer amount, sender → receiver, date/time, reference number.

Respond ONLY with a single JSON object — no prose, no markdown fences:

{
  "amount": number | null,             // amount in THB; for slips this is the transferred amount
  "kind": "expense" | "income",        // for receipts: usually expense. For slips: expense if user is the SENDER (most common), income if RECEIVER
  "occurredAt": "YYYY-MM-DDTHH:MM:SS" | null,  // local time as printed on the doc
  "note": string | null,               // for receipts: merchant + 1-3 word summary. For slips: "โอนให้ <recipient>" or "รับจาก <sender>". Thai if doc is Thai.
  "categoryId": string | null,         // pick one id from the list below; null if unsure
  "confidence": "high" | "medium" | "low"
}

Today is ${today}. If the doc has no year, assume current year. Thai dates may use Buddhist year (e.g. 2568) — convert to Gregorian (subtract 543).

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
            text: "Parse this receipt or transfer slip and return the JSON object only.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let parsed: Partial<ParsedReceipt> = {};
  try {
    // strip code fences if model added any despite instructions
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      amount: null,
      kind: "expense",
      occurredAt: null,
      note: null,
      categoryId: null,
      confidence: "low",
      raw,
    };
  }

  // Validate categoryId against the provided list (defense against hallucinated ids)
  const validIds = new Set(categories.map((c) => c.id));
  const categoryId =
    parsed.categoryId && validIds.has(parsed.categoryId)
      ? parsed.categoryId
      : null;

  return {
    amount:
      typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : null,
    kind: parsed.kind === "income" ? "income" : "expense",
    occurredAt:
      typeof parsed.occurredAt === "string" && parsed.occurredAt.length > 0
        ? parsed.occurredAt
        : null,
    note: typeof parsed.note === "string" ? parsed.note : null,
    categoryId,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
    raw,
  };
}
