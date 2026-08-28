import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmojiOrIcon } from "@/components/icons";
import type { TransactionWithCategory } from "@/lib/types";

/**
 * Compact recent-transactions card for the dashboard. One rounded card,
 * rows divided by hairline borders, no day-group headers.
 *
 * The full `<TransactionList>` is still used on `/transactions` where
 * users need day grouping, search highlight, delete actions, etc. This
 * one is read-only and stays dense so 5 rows fit without scrolling on
 * a small phone.
 */

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatBaht(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export async function RecentTransactionsCompact({
  items,
  currency,
  fmtLocale,
  showTrip = true,
}: {
  items: TransactionWithCategory[];
  currency: string;
  fmtLocale: string;
  showTrip?: boolean;
}) {
  const t = await getTranslations();

  return (
    <section className="fade-rise fade-rise-delay-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{t("dashboard.recent")}</h2>
        <Link
          href="/transactions"
          className="text-sm text-(--accent) hover:underline shrink-0"
        >
          {t("dashboard.viewAll")}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[22px] soft-raised p-8 text-center text-sm text-(--muted)">
          {t("transactions.emptyTitle")}
        </div>
      ) : (
        <ul className="rounded-[22px] soft-raised overflow-hidden">
          {items.map((tx, idx) => {
            const sign = tx.kind === "income" ? "+" : "−";
            const signClass =
              tx.kind === "income" ? "text-(--income)" : "text-(--expense)";
            const time = formatTime(tx.occurred_at);
            const catName = tx.category?.name ?? t("common.uncategorized");
            // First line: prefer the user-typed note, fall back to the
            // category name so the row never says "—".
            const primary = tx.note ?? catName;
            // Sub-line repeats the category only when the primary line
            // is a note (otherwise we'd duplicate the same string).
            const showCategoryOnSub = !!tx.note;
            return (
              <li
                key={tx.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx === 0 ? "" : "border-t border-(--soft-shade)/45"
                }`}
              >
                <span
                  className="h-10 w-10 rounded-full soft-well-sm inline-flex items-center justify-center shrink-0"
                  aria-hidden
                >
                  <EmojiOrIcon
                    value={tx.category?.icon}
                    fallback="sparkle"
                    size={20}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{primary}</span>
                    {showTrip && tx.trip && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                        style={{
                          background: `${tx.trip.color ?? "var(--accent)"}22`,
                          color: tx.trip.color ?? "var(--accent)",
                        }}
                      >
                        <EmojiOrIcon value={tx.trip.icon} fallback="airplane" size={13} />
                        <span className="truncate max-w-[80px]">
                          {tx.trip.name}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-(--muted) truncate">
                    {showCategoryOnSub ? `${catName} · ` : ""}
                    {time}
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${signClass}`}>
                  {sign}
                  {formatBaht(tx.amount, tx.fx_currency ?? currency, fmtLocale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
