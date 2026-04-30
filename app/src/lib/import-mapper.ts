import Anthropic from "@anthropic-ai/sdk";
import type { Category, TxKind } from "@/lib/types";

export type CategorySuggestion = {
  /** category id from the existing list, or null if none fits */
  categoryId: string | null;
  /** if proposing a new category instead, this is the new name */
  newCategoryName: string | null;
  /** suggested icon (emoji) when proposing new */
  newCategoryIcon: string | null;
};

export type ImportRow = {
  note: string;
  kind: TxKind;
};

export type RowMapping = {
  note: string;
  kind: TxKind;
  suggestion: CategorySuggestion;
};

/**
 * Group identical (note, kind) pairs and ask Claude to map each unique
 * pair to either an existing category or a new one. We send all unique
 * notes in one request to keep cost / latency low.
 */
export async function mapNotesToCategories(
  rows: ImportRow[],
  categories: Category[]
): Promise<Map<string, CategorySuggestion>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ฟีเจอร์นี้ต้องการ ANTHROPIC_API_KEY");
  }

  // Dedup by (note, kind)
  const uniq = new Map<string, ImportRow>();
  for (const r of rows) {
    const k = `${r.kind}:::${r.note}`;
    if (!uniq.has(k)) uniq.set(k, r);
  }
  const items = Array.from(uniq.entries()).map(([k, v], i) => ({
    key: k,
    idx: i,
    ...v,
  }));
  if (items.length === 0) return new Map();

  const catList = categories
    .map((c) => `- id=${c.id} kind=${c.kind} | ${c.icon ?? "✨"} ${c.name}`)
    .join("\n");

  const itemsList = items
    .map((it) => `${it.idx}. [${it.kind}] "${it.note.replace(/"/g, '\\"')}"`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    system: `You are mapping freeform Thai/English transaction notes from a Numbers spreadsheet into the user's category list. For each item, either pick an existing category id (when there's a clear match), OR propose a new category name + emoji.

Rules:
- Match against EXISTING categories first; only propose a new one when nothing fits well.
- The new category MUST be reusable across multiple transactions, not specific to one merchant. (Good: "เน็ต/มือถือ", "หนี้บัตรเครดิต". Bad: "AIS", "Spotify".)
- Use Thai for Thai users. Keep names short (1-3 words).
- The emoji should be a single character (or compound) representing the category.
- Each item MUST be assigned to a category whose kind matches the item's kind (income vs expense).

Return ONLY a JSON object with this shape — no prose, no markdown fences:

{
  "mappings": [
    { "idx": 0, "categoryId": "<uuid>", "newCategoryName": null, "newCategoryIcon": null },
    { "idx": 1, "categoryId": null, "newCategoryName": "หนี้บัตรเครดิต", "newCategoryIcon": "💳" },
    ...
  ]
}

Mapping hints:
- "ค่ากิน *" / food-like → existing "อาหาร"
- "AIS เน็ต*" / "3bb *" / "wifi" → propose "เน็ต/มือถือ" 📱 (or use existing "ที่อยู่อาศัย" if no clear comm category)
- "Spotify" / "Netflix" / streaming → existing "บันเทิง"
- "ดูหนัง *" → existing "บันเทิง"
- "ค่าไฟ" / "ค่าน้ำ" → existing "ที่อยู่อาศัย"
- "บัตรเครดิต *" → propose "หนี้บัตรเครดิต" 💳 (this is paying off the bill)
- "เก็บเงิน *" / "ออม" → propose "ออมเงิน" 💰
- "แชร์ *" (group savings circle) → propose "แชร์" 🤝
- "ค่าเรียน*" / "เรียน*" → existing "การศึกษา"
- "เสื้อ *" / "กางเกง *" → propose "เสื้อผ้า" 👕
- "ค่าเดินทาง *" / "BTS" / "MRT" / "taxi" → existing "เดินทาง"`,
    messages: [
      {
        role: "user",
        content: `Existing categories:\n${catList}\n\nItems to map (idx — kind — note):\n${itemsList}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let parsed: { mappings?: Array<{ idx: number; categoryId: string | null; newCategoryName: string | null; newCategoryIcon: string | null }> } = {};
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[import-mapper] parse failed:", e, raw);
    throw new Error("AI ตอบกลับมาไม่ถูกต้อง — ลองอีกครั้ง");
  }

  const validIds = new Set(categories.map((c) => c.id));
  const result = new Map<string, CategorySuggestion>();

  for (const m of parsed.mappings ?? []) {
    const item = items[m.idx];
    if (!item) continue;
    const useExisting = m.categoryId && validIds.has(m.categoryId);
    result.set(item.key, {
      categoryId: useExisting ? m.categoryId : null,
      newCategoryName: useExisting ? null : (m.newCategoryName ?? null),
      newCategoryIcon: useExisting ? null : (m.newCategoryIcon ?? "✨"),
    });
  }

  // Defensive: any unique item the model missed → leave unmapped (UI shows "อื่น ๆ")
  for (const it of items) {
    if (!result.has(it.key)) {
      result.set(it.key, {
        categoryId: null,
        newCategoryName: null,
        newCategoryIcon: null,
      });
    }
  }

  return result;
}
