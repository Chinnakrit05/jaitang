import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { sortByHierarchy } from "@/lib/categories";
import type { Category, TransactionWithCategory } from "@/lib/types";

/** One transaction the model wants to move, after validation. */
export type RecategorizeProposal = {
  txId: string;
  /** Category the model picked. Never null — a null pick means "leave
   *  it alone", which is dropped rather than returned as a change. */
  categoryId: string;
  confidence: "high" | "medium";
};

const ProposalSchema = z.object({
  txId: z.string(),
  categoryId: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

const ResultSchema = z.object({
  proposals: z.array(ProposalSchema),
});

/** What the model returns, before any of it is believed. */
export type RawProposal = {
  txId: string;
  categoryId: string | null;
  confidence: "high" | "medium" | "low";
};

/**
 * Turn raw model output into the moves worth showing a user.
 *
 * Every rule here is a reason to leave a transaction exactly as it is,
 * and all of them are enforced rather than asked for in the prompt:
 *
 *  - "low" confidence, or no pick at all, means keep the current
 *    category — the behaviour the feature was asked for
 *  - an id that is not in this ledger's category list is dropped, not
 *    written; the model can hallucinate one
 *  - an expense may not land in an income category, or the reverse
 *  - agreeing with the category a transaction already has is not a
 *    change, so it never reaches the review screen
 *  - a second opinion about the same transaction is ignored; the first
 *    one wins rather than the last
 *
 * Split out from the API call so the rules can be tested without a
 * network round-trip.
 */
export function keepConfidentMoves(
  raw: RawProposal[],
  txs: TransactionWithCategory[],
  categories: Category[]
): RecategorizeProposal[] {
  const txById = new Map(txs.map((tx) => [tx.id, tx]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const out: RecategorizeProposal[] = [];
  const seen = new Set<string>();

  for (const p of raw) {
    if (p.confidence === "low" || !p.categoryId) continue;
    if (seen.has(p.txId)) continue;
    const tx = txById.get(p.txId);
    if (!tx) continue;
    const target = catById.get(p.categoryId);
    if (!target) continue;
    if (target.kind !== tx.kind) continue;
    if (target.id === tx.category_id) continue;
    seen.add(p.txId);
    out.push({ txId: p.txId, categoryId: target.id, confidence: p.confidence });
  }
  return out;
}

/** Rows the model is asked about. Trimmed to what a categorization
 *  decision actually needs — sending accounts, trips and fx would just
 *  be tokens the model has to look past. */
type Candidate = {
  id: string;
  note: string;
  amount: number;
  kind: string;
  currentCategory: string;
};

/** "อาหาร › คาเฟ่" for a sub, plain name for a top-level one. Giving
 *  the model the path rather than the bare leaf is what lets it tell
 *  "คาเฟ่ (under อาหาร)" from a same-named category elsewhere. */
function categoryPath(c: Category, byId: Map<string, Category>): string {
  const parent = c.parent_id ? byId.get(c.parent_id) : null;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/**
 * Ask the model where every transaction in a month belongs.
 *
 * Two rules shape the result, and both are enforced here rather than
 * trusted to the prompt:
 *
 *  - anything the model is not confident about keeps the category it
 *    already has. "low" is dropped outright, and so is a null pick.
 *  - a proposal that matches the transaction's current category is not
 *    a change, so it never reaches the review screen.
 *
 * The caller gets only genuine, confident moves.
 */
export async function proposeRecategorization(
  txs: TransactionWithCategory[],
  categories: Category[]
): Promise<RecategorizeProposal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ฟีเจอร์นี้ต้องการ ANTHROPIC_API_KEY — ดู SETUP.md สำหรับวิธีตั้งค่า"
    );
  }
  if (txs.length === 0 || categories.length === 0) return [];

  const byId = new Map(categories.map((c) => [c.id, c]));
  // Parents before their own subs, so the list reads as a tree.
  const catList = sortByHierarchy(categories)
    .map((c) => `- ${c.id} | ${c.kind} | ${categoryPath(c, byId)}`)
    .join("\n");

  const candidates: Candidate[] = txs.map((tx) => ({
    id: tx.id,
    note: tx.note ?? "",
    amount: tx.amount,
    kind: tx.kind,
    currentCategory: tx.category
      ? categoryPath(
          (byId.get(tx.category.id) ?? {
            ...tx.category,
            parent_id: null,
          }) as Category,
          byId
        )
      : "(ไม่ระบุหมวด)",
  }));

  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ResultSchema),
    },
    system: `You re-file a month of personal-finance transactions into the user's own category tree.

For every transaction you are given, decide which category it belongs in.

- Pick from the id list below and nothing else. Never invent an id.
- Prefer the most specific match. If a subcategory fits ("อาหาร › คาเฟ่"), pick the subcategory rather than its parent.
- A transaction's kind must match the category's kind. Never file an expense under an income category or the reverse.
- The note is the main signal. Amount is a weak hint (a 40-baht "กาแฟ" is a drink, a 40,000-baht one is not).
- Many transactions are already filed correctly. Returning the category a transaction already has is a perfectly good answer.
- confidence "high" means the note names the thing plainly. "medium" means it is a reasonable read. Use "low" whenever you are guessing, the note is empty, or it could sit in two categories equally well — a low answer is thrown away and the transaction keeps what it has, which is the outcome the user wants when you are unsure.
- Use null for categoryId when nothing in the list fits.

Return one entry per transaction, using the exact txId given.

Available categories (id | kind | path):
${catList}`,
    messages: [
      {
        role: "user",
        content: JSON.stringify(candidates),
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return [];

  return keepConfidentMoves(parsed.proposals, txs, categories);
}
