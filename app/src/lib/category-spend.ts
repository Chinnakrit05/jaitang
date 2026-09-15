import type { TxKind } from "@/lib/types";

/**
 * What a category has spent across a set of transactions, counting its
 * subcategories as part of it.
 *
 * Subcategories count because that is how the roll-up is organised: the
 * recurring rule sits on the parent ("แมว") while the receipts may be
 * filed one level down (อาหารแมว, ทรายแมว). A total that only matched
 * the parent's own id would read ฿0 beside a month full of cat food.
 *
 * Only one level down — the category tree is two deep.
 */
export function categorySpend(
  txs: Array<{ kind: TxKind; category_id: string | null; amount: number }>,
  categories: Array<{ id: string; parent_id: string | null }>,
  target: { kind: TxKind; categoryId: string }
): number {
  const ids = new Set([
    target.categoryId,
    ...categories.filter((c) => c.parent_id === target.categoryId).map((c) => c.id),
  ]);
  const total = txs
    .filter((tx) => tx.kind === target.kind && tx.category_id !== null && ids.has(tx.category_id))
    .reduce((sum, tx) => sum + tx.amount, 0);
  // Summing satang-precision floats drifts (0.1 + 0.2); round to what a
  // numeric(14,2) column can hold so the label never reads ฿300.0000001.
  return Math.round(total * 100) / 100;
}
