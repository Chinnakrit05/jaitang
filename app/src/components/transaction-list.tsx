"use client";

import { useTransition } from "react";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import type { TransactionWithCategory } from "@/lib/types";
import {
  formatCurrencyCompact,
  dayKeyInTz,
  highlightSegments,
} from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import { EmptyIllustration } from "@/components/empty-illustration";
import { removeTransactionFromTripAction } from "@/app/(app)/trips/actions";
import { useRouter } from "next/navigation";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatDayHeader(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function TransactionList({
  items,
  showAttribution = false,
  currency = "THB",
  showTrip = true,
  showRemoveFromTrip = false,
  highlight,
}: {
  items: TransactionWithCategory[];
  showAttribution?: boolean;
  currency?: string;
  showTrip?: boolean;
  showRemoveFromTrip?: boolean;
  highlight?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-(--border) bg-(--card)/40 p-12 text-center">
        <EmptyIllustration kind="transactions" className="mb-4" />
        <p className="font-semibold mb-1.5">{t("transactions.emptyTitle")}</p>
        <p className="text-sm text-(--muted) mb-5 max-w-xs mx-auto">
          {t("transactions.emptyHint")}
        </p>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm cta-primary"
        >
          + {t("transactions.addNew")}
        </Link>
      </div>
    );
  }

  // Group by day in the BROWSER's local timezone. Same reasoning as before:
  // a naive `.slice(0, 10)` on the ISO string would push a 03:00 Bangkok
  // transaction into the previous calendar day's group.
  const groups = new Map<string, TransactionWithCategory[]>();
  for (const tx of items) {
    const day = dayKeyInTz(tx.occurred_at);
    const arr = groups.get(day) ?? [];
    arr.push(tx);
    groups.set(day, arr);
  }

  return (
    <div className="space-y-3">
      {Array.from(groups.entries()).map(([day, txs]) => {
        const dayIncome = txs
          .filter((tx) => tx.kind === "income")
          .reduce((s, tx) => s + tx.amount, 0);
        const dayExpense = txs
          .filter((tx) => tx.kind === "expense")
          .reduce((s, tx) => s + tx.amount, 0);
        const dayNet = dayIncome - dayExpense;

        const [yStr, mStr, dStr] = day.split("-");
        const headerDate = new Date(
          Number(yStr),
          Number(mStr) - 1,
          Number(dStr)
        );

        return (
          <section
            key={day}
            className="rounded-3xl bg-(--card) border border-(--border) overflow-hidden"
          >
            <header className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-base font-bold tabular-nums">
                {formatDayHeader(headerDate, fmtLocale)}
              </h3>
              <span
                className={`text-base font-bold tabular-nums ${
                  dayNet > 0
                    ? "text-(--income)"
                    : "text-(--foreground)"
                }`}
              >
                {formatCurrencyCompact(Math.abs(dayNet), currency, fmtLocale)}
              </span>
            </header>
            <ul className="divide-y divide-(--border)/60">
              {txs.map((tx) => {
                const time = formatTime(tx.occurred_at);
                const catName =
                  tx.category?.name ?? t("common.uncategorizedFull");
                // Primary line: user note when present, falling back to the
                // category. Matches the recent-transactions-compact layout
                // so the two surfaces feel cohesive.
                const primary = tx.note ?? catName;
                const showCategoryOnSub = !!tx.note;
                return (
                  <li key={tx.id} className="relative group">
                    <Link
                      href={`/transactions/${tx.id}/edit`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-(--background)/60 transition"
                    >
                      <span
                        className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background:
                            "color-mix(in srgb, #F9D5B4 35%, var(--card))",
                        }}
                        aria-hidden
                      >
                        <EmojiOrIcon
                          value={tx.category?.icon}
                          fallback="sparkle"
                          size={22}
                        />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-[15px] truncate">
                            {highlight
                              ? highlightSegments(primary, highlight).map(
                                  (seg, i) =>
                                    seg.match ? (
                                      <mark
                                        key={i}
                                        className="bg-(--accent)/20 text-(--foreground) rounded px-0.5"
                                      >
                                        {seg.text}
                                      </mark>
                                    ) : (
                                      <span key={i}>{seg.text}</span>
                                    )
                                )
                              : primary}
                          </span>
                          {showTrip && tx.trip && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                              style={{
                                background: `${tx.trip.color ?? "var(--accent)"}22`,
                                color: tx.trip.color ?? "var(--accent)",
                              }}
                            >
                              <EmojiOrIcon
                                value={tx.trip.icon}
                                fallback="airplane"
                                size={14}
                              />
                              <span className="truncate max-w-[80px]">
                                {tx.trip.name}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-(--muted) flex items-center gap-1.5 flex-wrap min-w-0">
                          {showCategoryOnSub && (
                            <>
                              <span className="truncate">{catName}</span>
                              <span>·</span>
                            </>
                          )}
                          {tx.fx_currency && tx.fx_amount !== null && (
                            <>
                              <span
                                className="tabular-nums"
                                title={
                                  tx.fx_rate
                                    ? `1 ${tx.fx_currency} ≈ ${tx.fx_rate.toFixed(4)} ${currency}`
                                    : undefined
                                }
                              >
                                {formatCurrencyCompact(
                                  tx.fx_amount,
                                  tx.fx_currency,
                                  fmtLocale
                                )}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span className="tabular-nums">{time}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div
                          className={`tabular-nums font-bold text-[15px] ${
                            tx.kind === "income"
                              ? "text-(--income)"
                              : "text-(--foreground)"
                          }`}
                        >
                          {tx.kind === "income" ? "+" : "−"}
                          {formatCurrencyCompact(tx.amount, currency, fmtLocale)}
                        </div>
                        {tx.payment_method && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-(--muted)">
                            {tx.payment_method === "cash" ? (
                              <JtIcon name="banknote" size={12} />
                            ) : (
                              <JtIcon name="landmark" size={12} />
                            )}
                            <span>
                              {tx.payment_method === "cash"
                                ? t("transactions.paymentCash")
                                : t("transactions.paymentTransfer")}
                            </span>
                          </span>
                        )}
                      </div>
                    </Link>
                    {/* Row actions: hover-revealed on desktop. Absolute-
                        positioned over the right edge so the row stays a
                        single Link target on mobile (tap → edit page),
                        matching the mockup which doesn't expose inline
                        actions on touch. */}
                    <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 opacity-0 group-hover:opacity-100 transition bg-(--card) rounded-lg px-1 shadow-sm">
                      {showRemoveFromTrip && tx.trip && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(t("trips.removeFromTripConfirm"))) return;
                            startTransition(async () => {
                              await removeTransactionFromTripAction(tx.id);
                              router.refresh();
                            });
                          }}
                          className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background) hover:text-(--foreground)"
                          aria-label={t("trips.removeFromTrip")}
                          title={t("trips.removeFromTrip")}
                        >
                          <JtIcon name="x" size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(t("transactions.deleteConfirm"))) return;
                          startTransition(async () => {
                            await deleteTransactionAction(tx.id);
                            router.refresh();
                          });
                        }}
                        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
                        aria-label={t("common.delete")}
                      >
                        <JtIcon name="trash2" size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
