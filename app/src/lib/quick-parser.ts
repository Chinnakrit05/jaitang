import Anthropic from "@anthropic-ai/sdk";
import type { Category, TxKind } from "@/lib/types";

export type QuickParseResult = {
  amount: number | null;
  kind: TxKind;
  categoryId: string | null;
  note: string | null;
  occurredAt: string | null; // ISO
  confidence: "high" | "medium" | "low";
  raw: string;
};

/**
 * Parse a freeform short message ("30 bts", "ค่ากาแฟ 65", "salary 30000")
 * into transaction fields. Server-only — needs ANTHROPIC_API_KEY.
 *
 * Cheaper + faster than the receipt OCR path because we only send text,
 * but we use the same model and category-grounding logic.
 */
export async function parseQuickText(
  text: string,
  categories: Category[]
): Promise<QuickParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ฟีเจอร์นี้ต้องการ ANTHROPIC_API_KEY — ดู SETUP.md / This feature needs ANTHROPIC_API_KEY"
    );
  }

  const trimmed = text.trim();
  if (!trimmed) throw new Error("กรุณาพิมพ์ข้อความ");

  const catList = categories
    .map((c) => `- ${c.id} | ${c.kind} | ${c.icon ?? "✨"} ${c.name}`)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: `You parse a single short sentence (Thai, English, or mixed) into a financial transaction. Reply ONLY with one JSON object — no prose, no markdown fences. Schema:

{
  "amount": number | null,                 // primary monetary amount in THB
  "kind": "expense" | "income",            // default to "expense" unless clearly income (salary, paid, received, +)
  "occurredAt": "YYYY-MM-DDTHH:MM:SS" | null,  // when the transaction happened, local time. null = now
  "note": string | null,                   // a clean short description (3–10 words). Use the user's language. Strip the amount/digits.
  "categoryId": string | null,             // pick best-matching id from the list below; null only if no reasonable match
  "confidence": "high" | "medium" | "low"
}

Tips:
- "30 bts", "bts 30", "30 บาท bts" → amount: 30, category: transit/transport
- "ค่ากาแฟ 65" → amount: 65, category: food/coffee
- "เงินเดือน 30000" → amount: 30000, kind: income, category: salary
- "+500 freelance" → income 500, category: bonus/income
- Date words: "เมื่อวาน" / "yesterday" → occurredAt one day before today (${today})

Categories (id | kind | label):
${catList}`,
    messages: [
      {
        role: "user",
        content: `Parse this: "${trimmed.replace(/"/g, '\\"')}"`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let parsed: Partial<QuickParseResult> = {};
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      amount: null,
      kind: "expense",
      categoryId: null,
      note: trimmed,
      occurredAt: null,
      confidence: "low",
      raw,
    };
  }

  const validIds = new Set(categories.map((c) => c.id));
  const categoryId =
    parsed.categoryId && validIds.has(parsed.categoryId) ? parsed.categoryId : null;

  return {
    amount:
      typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : null,
    kind: parsed.kind === "income" ? "income" : "expense",
    categoryId,
    note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note : trimmed,
    occurredAt:
      typeof parsed.occurredAt === "string" && parsed.occurredAt.length > 0
        ? parsed.occurredAt
        : null,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
    raw,
  };
}
