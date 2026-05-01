"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Banknote, Landmark, Pencil, Trash2 } from "lucide-react";
import type { TransactionWithCategory } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import { useRouter } from "next/navigation";

export function TransactionList({
  items,
  showAttribution = false,
  currency = "THB",
}: {
  items: TransactionWithCategory[];
  showAttribution?: boolean;
  currency?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
        <span className="text-4xl mb-3 block">📭</span>
        <p className="font-medium mb-1">{t("transactions.emptyTitle")}</p>
        <p className="text-sm text-(--muted) mb-4">{t("transactions.emptyHint")}</p>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
        >
          + {t("transactions.addNew")}
        </Link>
      </div>
    );
  }

  // Group by day
  const groups = new Map<string, TransactionWithCategory[]>();
  for (const tx of items) {
    const day = tx.occurred_at.slice(0, 10);
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

        return (
          <section key={day}>
            <header className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-(--muted)">
                {new Intl.DateTimeFormat(fmtLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  weekday: "short",
                }).format(new Date(day))}
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
                      <div className="text-sm text-(--muted) truncate">{tx.note}</div>
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
