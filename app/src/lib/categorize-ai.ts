import Anthropic from "@anthropic-ai/sdk";
import type { Category, TxKind } from "@/lib/types";

export type SuggestionResult = {
  categoryId: string | null;
  confidence: "high" | "medium" | "low";
};

/**
 * Suggest a category id given a free-form transaction note.
 *
 * Cheap + fast: a short text-only Haiku call. We send the candidate
 * categories filtered to the right kind (expense vs income) and the
 * model returns a single id (or null when nothing fits well).
 *
 * Returns null when the API key is missing — the caller should treat
 * "no suggestion" as "user picks manually". Errors propagate so the
 * UI can surface them.
 */
export async function suggestCategory(
  note: string,
  kind: TxKind,
  categories: Category[]
): Promise<SuggestionResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const trimmed = note.trim();
  if (trimmed.length === 0) return null;

  const candidates = categories.filter((c) => c.kind === kind);
  if (candidates.length === 0) return null;

  const catList = candidates
    .map((c) => `- ${c.id} | ${c.icon ?? "✨"} ${c.name}`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    system: `You suggest a category for a personal-finance transaction note.

Respond ONLY with a single JSON object — no prose, no markdown fences:

{
  "categoryId": "<id from the list, or null if nothing fits>",
  "confidence": "high" | "medium" | "low"
}

Notes are usually short Thai or English phrases like "ก๋วยเตี๋ยวเรือ", "Starbucks latte", "ค่าแท็กซี่ไป BTS", "Spotify monthly". Pick the id whose label best matches the note's intent. Use "low" confidence + null id when none of the candidates is a good fit.

Available categories (id | label) — kind = ${kind}:
${catList}`,
    messages: [
      {
        role: "user",
        content: trimmed,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let parsed: Partial<SuggestionResult> = {};
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { categoryId: null, confidence: "low" };
  }

  // Defend against hallucinated ids — only accept ids that are in the
  // candidate set.
  const validIds = new Set(candidates.map((c) => c.id));
  const categoryId =
    parsed.categoryId && validIds.has(parsed.categoryId)
      ? parsed.categoryId
      : null;

  return {
    categoryId,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
  };
}
