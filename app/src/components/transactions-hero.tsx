import { Mascot } from "@/components/mascots";
import { formatCurrencyCompact } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export async function TransactionsHero({
  count,
  income,
  expense,
  currency,
  fmtLocale,
}: {
  count: number;
  income: number;
  expense: number;
  currency: string;
  fmtLocale: string;
}) {
  const t = await getTranslations();

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-(--border) px-4 py-4 sm:px-5 sm:py-5 fade-rise"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 55%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 22%, var(--card)) 100%)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--card) 75%, transparent)",
          }}
          aria-hidden
        >
          <Mascot size={64} idPrefix="tx-hero" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-[15px] text-(--foreground)/85">
            {t("transactions.heroSummary", { count: String(count) })}
          </p>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <span className="text-lg sm:text-xl font-bold tabular-nums text-(--income)">
              +{formatCurrencyCompact(income, currency, fmtLocale)}
            </span>
            <span className="text-lg sm:text-xl font-bold tabular-nums text-(--expense)">
              −{formatCurrencyCompact(expense, currency, fmtLocale)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
