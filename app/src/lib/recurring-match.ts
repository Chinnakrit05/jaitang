import type { TxKind } from "@/lib/types";

/** What a scan looks like to the matcher. Trimmed to the fields that
 *  say anything about which bill this is. */
export type ScanSummary = {
  kind: TxKind;
  /** Shop or biller name off the document. */
  merchant: string | null;
  /** The line names, joined — a bill's line often names the service
   *  even when the merchant line is a payment processor. */
  itemText: string;
  amount: number;
  /** Categories the scan's lines landed in. */
  categoryIds: string[];
};

/** A due variable-cost rule, as far as matching is concerned. */
export type RecurringCandidate = {
  id: string;
  note: string | null;
  kind: TxKind;
  categoryId: string | null;
  /** What the user typed for this bill last cycle, if ever. */
  lastFillAmount: number | null;
};

export type RecurringMatch = {
  ruleId: string;
  confidence: "high" | "medium";
  /** Which signals fired, so the UI can say why it is asking. */
  reasons: Array<"category" | "text" | "amount">;
};

/** Strip everything that varies between how a bill prints its name and
 *  how the user typed the rule: case, spaces, punctuation, and the
 *  "[ค่าประจำ]" tag the filler adds to transaction notes. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[ค่าประจำ\]/g, " ")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

/**
 * Dice coefficient over character bigrams, 0..1.
 *
 * Word-boundary matching is useless here: Thai doesn't space its words,
 * so "ค่าไฟฟ้าเดือนนี้" and "ค่าไฟ" share no token but plenty of
 * characters. Bigrams give a score that works the same in either script.
 */
export function textSimilarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2);
    bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2);
    const left = bigrams.get(g) ?? 0;
    if (left > 0) {
      bigrams.set(g, left - 1);
      hits++;
    }
  }
  return (2 * hits) / (x.length - 1 + (y.length - 1));
}

const TEXT_HIT = 0.34;
const AMOUNT_TOLERANCE = 0.25;

/**
 * Which recurring bill, if any, this scan looks like paying.
 *
 * Only rules that are already due and still waiting for an amount are
 * worth offering — those are the ones where the alternative is the user
 * recording the payment twice, once as a fresh transaction and once by
 * filling the bill. The caller is responsible for passing that set.
 *
 * Three independent signals, and one alone is only ever a question:
 *
 *  - the rule's category is one the scan's lines landed in
 *  - the rule's note reads like the merchant or the line items
 *  - the amount is near what the same bill cost last cycle
 *
 * Two signals make it confident. Nothing scores at all when the kinds
 * differ, so an income slip can never offer to pay a bill.
 *
 * Pure on purpose: this decides whether the user gets asked to write a
 * transaction against a rule, and that deserves tests rather than a
 * model's opinion.
 */
export function matchRecurring(
  scan: ScanSummary,
  candidates: RecurringCandidate[]
): RecurringMatch | null {
  // Scored against each field on its own rather than one joined blob:
  // Dice is a ratio, so pasting the merchant line in front of the item
  // line dilutes a perfectly good match on either one.
  const scanTexts = [scan.merchant ?? "", scan.itemText].filter(Boolean);
  const categoryIds = new Set(scan.categoryIds.filter(Boolean));

  let best: (RecurringMatch & { score: number }) | null = null;

  for (const rule of candidates) {
    if (rule.kind !== scan.kind) continue;

    const reasons: RecurringMatch["reasons"] = [];
    let score = 0;

    if (rule.categoryId && categoryIds.has(rule.categoryId)) {
      score += 3;
      reasons.push("category");
    }
    const noteScore = rule.note
      ? Math.max(0, ...scanTexts.map((text) => textSimilarity(rule.note!, text)))
      : 0;
    if (noteScore >= TEXT_HIT) {
      score += 3;
      reasons.push("text");
    }
    if (
      rule.lastFillAmount &&
      rule.lastFillAmount > 0 &&
      Math.abs(scan.amount - rule.lastFillAmount) / rule.lastFillAmount <=
        AMOUNT_TOLERANCE
    ) {
      score += 2;
      reasons.push("amount");
    }

    if (score < 3) continue;
    if (!best || score > best.score) {
      best = {
        ruleId: rule.id,
        confidence: score >= 5 ? "high" : "medium",
        reasons,
        score,
      };
    }
  }

  if (!best) return null;
  const { ruleId, confidence, reasons } = best;
  return { ruleId, confidence, reasons };
}
