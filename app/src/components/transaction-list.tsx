"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Banknote, Landmark, Pencil, Trash2, X } from "lucide-react";
import type { TransactionWithCategory } from "@/lib/types";
import {
  formatDate,
  formatCurrency,
  dayKeyInTz,
  highlightSegments,
} from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import { removeTransactionFromTripAction } from "@/app/(app)/trips/actions";
import { useRouter } from "next/navigation";

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
  /** Show "🏖️ ทริปทะเล" badge on rows that belong to a trip. Hide it on
   *  the trip detail page where the badge is redundant context. */
  showTrip?: boolean;
  /** Show a small "remove from trip" button per row. Trip detail page only. */
  showRemoveFromTrip?: boolean;
  /** When the parent page is in search mode, pass the query string here so
   *  the note column can wrap matches in <mark>. */
  highlight?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 p-12 text-center">
        <div className="mx-auto mb-4 inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-(--background) border border-(--border)">
          <span className="text-3xl" aria-hidden>📭</span>
        </div>
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

  // Group by day in the BROWSER's local timezone. The naive `.slice(0, 10)`
  // we used to do takes the UTC date out of the ISO string — for a Bangkok
  // user, a transaction recorded at 03:00 local (= 20:00 UTC the previous
  // day) would land in the wrong day group, with the section header
  // claiming May 1 while the row plainly displayed May 2 03:00.
  const groups = new Map<string, TransactionWithCategory[]>();
  for (const tx of items) {
    const day = dayKeyInTz(tx.occurred_at);
    const arr = groups.get(day) ?? [];
    arr.push(tx);
    groups.set(day, arr);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, txs]) => {
        const dayIncome = txs
          .filter((t) => t.kind === "income")
          .reduce((s, t) => s + t.amount, 0);
        const dayExpense = txs
          .filter((t) => t.kind === "expense")
          .reduce((s, t) => s + t.amount, 0);

        // Construct from parts so the header date is the LOCAL midnight of
        // the day key — not `new Date("YYYY-MM-DD")` which would be parsed
        // as UTC midnight and could shift a date for users far from UTC.
        const [yStr, mStr, dStr] = day.split("-");
        const headerDate = new Date(
          Number(yStr),
          Number(mStr) - 1,
          Number(dStr)
        );

        return (
          <section key={day}>
            <header className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-(--muted)">
                {new Intl.DateTimeFormat(fmtLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  weekday: "short",
                }).format(headerDate)}
              </h3>
              <span className="text-xs tabular-nums text-(--muted)">
                {dayIncome > 0 && (
                  <span className="text-(--income) mr-2">
                    +{formatCurrency(dayIncome, currency, fmtLocale)}
                  </span>
                )}
                {dayExpense > 0 && (
                  <span className="text-(--expense)">
                    −{formatCurrency(dayExpense, currency, fmtLocale)}
                  </span>
                )}
              </span>
            </header>
            <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
              {txs.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition group"
                >
                  <span className="text-2xl">{tx.category?.icon ?? "✨"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {tx.category?.name ?? t("common.uncategorizedFull")}
                    </div>
                    {tx.note && (
                      <div className="text-sm text-(--muted) truncate">
                        {highlight
                          ? highlightSegments(tx.note, highlight).map(
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
                          : tx.note}
                      </div>
                    )}
                    <div className="text-xs text-(--muted) flex items-center gap-1.5 flex-wrap">
                      <span>{formatDate(tx.occurred_at, fmtLocale)}</span>
                      {tx.payment_method && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            {tx.payment_method === "cash" ? (
                              <Banknote size={12} />
                            ) : (
                              <Landmark size={12} />
                            )}
                            <span>
                              {tx.payment_method === "cash"
                                ? t("transactions.paymentCash")
                                : t("transactions.paymentTransfer")}
                            </span>
                          </span>
                        </>
                      )}
                      {tx.fx_currency && tx.fx_amount !== null && (
                        <>
                          <span>•</span>
                          <span
                            className="tabular-nums"
                            title={
                              tx.fx_rate
                                ? `1 ${tx.fx_currency} ≈ ${tx.fx_rate.toFixed(4)} ${currency}`
                                : undefined
                            }
                          >
                            {formatCurrency(
                              tx.fx_amount,
                              tx.fx_currency,
                              fmtLocale
                            )}
                          </span>
                        </>
                      )}
                      {showAttribution && tx.user && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            {tx.user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tx.user.image}
                                alt={tx.user.name ?? tx.user.email}
                                className="h-3.5 w-3.5 rounded-full"
                              />
                            ) : null}
                            <span>{tx.user.name?.split(" ")[0] ?? "?"}</span>
                          </span>
                        </>
                      )}
                      {showTrip && tx.trip && (
                        <>
                          <span>•</span>
                          <Link
                            href={`/trips/${tx.trip.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-(--border) bg-(--background) hover:bg-(--card) transition"
                            style={
                              tx.trip.color
                                ? { borderColor: `${tx.trip.color}40` }
                                : undefined
                            }
                          >
                            <span className="text-[10px]">
                              {tx.trip.icon ?? "✈️"}
                            </span>
                            <span>{tx.trip.name}</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`tabular-nums font-semibold ${
                      tx.kind === "income" ? "text-(--income)" : "text-(--expense)"
                    }`}
                  >
                    {tx.kind === "income" ? "+" : "−"}
                    {formatCurrency(tx.amount, currency, fmtLocale)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
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
                        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
                        aria-label={t("trips.removeFromTrip")}
                        title={t("trips.removeFromTrip")}
                      >
                        <X size={16} />
                      </button>
                    )}
                    <Link
                      href={`/transactions/${tx.id}/edit`}
                      className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
                      aria-label={t("common.edit")}
                    >
                      <Pencil size={16} />
                    </Link>
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
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
