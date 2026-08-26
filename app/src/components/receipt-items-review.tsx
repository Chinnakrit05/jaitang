"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { createTransactionsFromReceiptAction } from "@/app/(app)/transactions/receipt-items-action";
import {
  composeReceiptNote,
  groupItemsByCategory,
  type ParsedReceiptItems,
  type ReceiptLineItem,
} from "@/lib/receipt-items";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A parsed line the user is still editing. `included` drives the
 *  checkbox; excluded lines stay visible (so nothing silently
 *  disappears) but leave the totals and the save payload. */
type EditableItem = ReceiptLineItem & { key: string; included: boolean };

const UNGROUPED_KEY = "__none__";

export function ReceiptItemsReview({
  parsed,
  categories,
  tripId = null,
  accountId = null,
  onClose,
}: {
  parsed: ParsedReceiptItems;
  categories: Category[];
  tripId?: string | null;
  accountId?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<EditableItem[]>(() =>
    parsed.items.map((item, index) => ({
      ...item,
      key: `${index}-${item.name}`,
      included: true,
    }))
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  // Only categories of the receipt's own kind can receive these lines.
  const pickable = useMemo(
    () => categories.filter((c) => c.kind === parsed.kind),
    [categories, parsed.kind]
  );

  // The heart of the screen: groups are derived, never stored. Changing
  // one line's category re-runs this and the cards merge or split on
  // the spot.
  const groups = useMemo(
    () => groupItemsByCategory(items.filter((i) => i.included)),
    [items]
  );

  const grandTotal = groups.reduce((sum, g) => sum + g.amount, 0);
  // The printed total includes things we deliberately skip (and the
  // user may have excluded lines), so this is a nudge, not an error.
  const mismatch =
    parsed.total !== null && Math.abs(parsed.total - grandTotal) > 0.5;

  function setItemCategory(key: string, categoryId: string | null) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, categoryId } : i))
    );
  }

  function toggleItem(key: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, included: !i.included } : i))
    );
  }

  function setItemAmount(key: string, raw: string) {
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) return;
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, amount: next } : i))
    );
  }

  function save() {
    setError(null);
    const rows = groups
      .filter((g) => g.amount > 0)
      .map((g) => ({
        categoryId: g.categoryId,
        amount: g.amount,
        note: composeReceiptNote(parsed.merchant, g.items),
        kind: parsed.kind,
        paymentMethod: parsed.paymentMethod,
      }));
    if (rows.length === 0) {
      setError(t("receiptItems.nothingSelected"));
      return;
    }
    startSaving(async () => {
      const result = await createTransactionsFromReceiptAction({
        rows,
        occurredAt: parsed.occurredAt
          ? new Date(parsed.occurredAt).toISOString()
          : new Date().toISOString(),
        tripId,
        accountId,
      });
      if (result.ok === false) {
        // created > 0 means some rows landed before the failure — say so
        // rather than letting the user re-save the whole receipt.
        setError(
          result.created > 0
            ? t("receiptItems.savedPartially", {
                count: result.created,
                error: result.error,
              })
            : result.error
        );
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,520px)] max-h-[88vh] flex flex-col rounded-2xl soft-raised-sm shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-lg">
              {t("receiptItems.title")}
            </h2>
            <p className="text-sm text-(--muted) mt-0.5 truncate">
              {parsed.merchant
                ? t("receiptItems.subtitleWithMerchant", {
                    merchant: parsed.merchant,
                    items: items.length,
                    groups: groups.length,
                  })
                : t("receiptItems.subtitle", {
                    items: items.length,
                    groups: groups.length,
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 p-1.5 rounded-lg hover:bg-(--background) transition"
          >
            <JtIcon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-3">
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-(--muted)">
              {t("receiptItems.nothingSelected")}
            </p>
          )}

          {groups.map((group) => {
            const category = group.categoryId
              ? categoryById.get(group.categoryId)
              : null;
            return (
              <div
                key={group.categoryId ?? UNGROUPED_KEY}
                className={cn(
                  "rounded-xl border bg-(--background)/40 overflow-hidden",
                  group.categoryId
                    ? "border-(--border)"
                    : "border-(--expense)/50"
                )}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-(--border) bg-(--card)">
                  <span className="flex items-center gap-2 min-w-0">
                    {category ? (
                      <EmojiOrIcon value={category.icon ?? "✨"} size={18} />
                    ) : (
                      <JtIcon name="help-circle" size={16} />
                    )}
                    <span className="font-medium text-sm truncate">
                      {category?.name ?? t("receiptItems.uncategorized")}
                    </span>
                    <span className="text-xs text-(--muted) shrink-0">
                      {t("receiptItems.itemCount", {
                        count: group.items.length,
                      })}
                    </span>
                  </span>
                  <span className="font-semibold text-sm tabular-nums shrink-0">
                    ฿{group.amount.toLocaleString("th-TH")}
                  </span>
                </div>

                <ul className="divide-y divide-(--border)">
                  {group.items.map((item) => (
                      <li
                        key={item.key}
                        className="px-3 py-2 flex flex-wrap items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => toggleItem(item.key)}
                          aria-label={t("receiptItems.exclude")}
                          className="shrink-0 p-1 rounded-md text-(--muted) hover:text-(--expense) hover:bg-(--card) transition"
                        >
                          <JtIcon name="x" size={14} />
                        </button>
                        <span className="flex-1 min-w-0 text-sm truncate">
                          {item.name}
                        </span>
                        {/* On a phone the amount + picker take their own
                            line. Sharing one row squeezed the item name
                            down to "นมสด…", which defeats the point of
                            a review screen. */}
                        <div className="flex items-center gap-2 basis-full pl-7 sm:basis-auto sm:pl-0">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) =>
                              setItemAmount(item.key, e.target.value)
                            }
                            className="w-20 shrink-0 text-right text-sm tabular-nums px-2 py-1 rounded-[12px] soft-raised-sm"
                          />
                          <select
                            value={item.categoryId ?? ""}
                            onChange={(e) =>
                              setItemCategory(item.key, e.target.value || null)
                            }
                            aria-label={t("common.category")}
                            className="flex-1 min-w-0 sm:flex-none sm:max-w-28 text-xs px-2 py-1 rounded-[12px] soft-raised-sm"
                          >
                            <option value="">
                              {t("receiptItems.uncategorized")}
                            </option>
                            {pickable.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Excluded lines stay listed so removing one is visibly
              undoable — a vanished row reads as data loss. */}
          {items.some((i) => !i.included) && (
            <div className="rounded-xl border border-dashed border-(--border) px-3 py-2">
              <p className="text-xs text-(--muted) mb-1.5">
                {t("receiptItems.excluded")}
              </p>
              <ul className="space-y-1">
                {items
                  .filter((i) => !i.included)
                  .map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-2 text-sm text-(--muted)"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.key)}
                        aria-label={t("common.undo")}
                        className="shrink-0 p-1 rounded-md hover:text-(--foreground) hover:bg-(--background) transition"
                      >
                        <JtIcon name="rotate-ccw" size={14} />
                      </button>
                      <span className="flex-1 min-w-0 truncate line-through">
                        {item.name}
                      </span>
                      <span className="tabular-nums text-xs shrink-0">
                        ฿{item.amount.toLocaleString("th-TH")}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-5 pt-3 space-y-2 border-t border-(--border)">
          {mismatch && (
            <p className="text-xs text-(--muted)">
              {t("receiptItems.totalMismatch", {
                printed: parsed.total!.toLocaleString("th-TH"),
              })}
            </p>
          )}
          {error && <p className="text-sm text-(--expense)">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-(--muted)">
              {t("receiptItems.grandTotal", {
                total: grandTotal.toLocaleString("th-TH"),
              })}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || groups.length === 0}
              className="px-4 py-2 rounded-xl bg-(--accent) text-white text-sm font-semibold disabled:opacity-50 transition"
            >
              {saving
                ? t("receiptItems.saving")
                : t("receiptItems.save", { count: groups.length })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
