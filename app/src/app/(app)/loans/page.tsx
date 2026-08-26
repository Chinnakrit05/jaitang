import Link from "next/link";
import { JtIcon } from "@/components/icons";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listLoans } from "@/lib/loans";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { LoanCard } from "@/components/loan-card";
import { CreateLoanForm } from "@/components/create-loan-form";

export default async function LoansPage() {
  const [{ ledgerId, ledger }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  const loans = await listLoans(ledgerId);
  const lent = loans.filter(
    (l) => l.kind === "lent" && l.status === "open" && l.remaining > 0
  );
  const borrowed = loans.filter(
    (l) => l.kind === "borrowed" && l.status === "open" && l.remaining > 0
  );
  const settled = loans.filter(
    (l) => l.status === "settled" || l.remaining === 0
  );

  // Per-currency totals (we don't try to FX-sum across currencies — too
  // misleading to roll, say, JPY 50,000 + THB 1,500 into one number).
  const lentByCurrency = new Map<string, number>();
  const borrowedByCurrency = new Map<string, number>();
  for (const l of lent) {
    lentByCurrency.set(
      l.currency,
      (lentByCurrency.get(l.currency) ?? 0) + l.remaining
    );
  }
  for (const l of borrowed) {
    borrowedByCurrency.set(
      l.currency,
      (borrowedByCurrency.get(l.currency) ?? 0) + l.remaining
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <JtIcon name="loans" size={26} className="text-(--accent)" />
          {t("loans.title")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">{t("loans.subtitle")}</p>
      </div>

      {/* Two-column summary: outstanding by direction + currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard
          label={t("loans.totalLent")}
          icon={<JtIcon name="arrow-up-right" size={22} />}
          tone="income"
          totals={lentByCurrency}
          fallbackCurrency={ledger.currency}
          fmtLocale={fmtLocale}
        />
        <SummaryCard
          label={t("loans.totalBorrowed")}
          icon={<JtIcon name="arrow-down-left" size={22} />}
          tone="expense"
          totals={borrowedByCurrency}
          fallbackCurrency={ledger.currency}
          fmtLocale={fmtLocale}
        />
      </div>

      {/* Lent */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
          {t("loans.lentSection", { count: lent.length })}
        </h2>
        {lent.length === 0 ? (
          <p className="text-xs text-(--muted) px-1">{t("loans.lentEmpty")}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lent.map((l) => (
              <LoanCard key={l.id} loan={l} fmtLocale={fmtLocale} />
            ))}
          </ul>
        )}
      </section>

      {/* Borrowed */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
          {t("loans.borrowedSection", { count: borrowed.length })}
        </h2>
        {borrowed.length === 0 ? (
          <p className="text-xs text-(--muted) px-1">
            {t("loans.borrowedEmpty")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {borrowed.map((l) => (
              <LoanCard key={l.id} loan={l} fmtLocale={fmtLocale} />
            ))}
          </ul>
        )}
      </section>

      {/* Create */}
      <section className="rounded-[22px] soft-raised p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <JtIcon name="plus-fab" size={20} />
          {t("loans.createTitle")}
        </h2>
        <p className="text-sm text-(--muted)">{t("loans.createHint")}</p>
        <CreateLoanForm ledgerCurrency={ledger.currency} />
      </section>

      {/* Settled */}
      {settled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
            {t("loans.settledSection", { count: settled.length })}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {settled.map((l) => (
              <LoanCard key={l.id} loan={l} fmtLocale={fmtLocale} />
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-(--muted)">
        <Link
          href="/dashboard"
          className="hover:text-(--foreground) underline"
        >
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  icon,
  tone,
  totals,
  fallbackCurrency,
  fmtLocale,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "income" | "expense";
  totals: Map<string, number>;
  fallbackCurrency: string;
  fmtLocale: string;
}) {
  const cls = tone === "income" ? "text-(--income)" : "text-(--expense)";
  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-[22px] soft-raised p-5 card-hover">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-(--muted) mb-2">
        <span className="font-medium">{label}</span>
        <span className={`${cls} opacity-70`}>{icon}</span>
      </div>
      {entries.length === 0 ? (
        <div className="text-sm text-(--muted) tabular-nums">
          {formatCurrency(0, fallbackCurrency, fmtLocale)}
        </div>
      ) : (
        <div className="space-y-0.5">
          {entries.map(([currency, sum]) => (
            <div
              key={currency}
              className={`text-2xl font-semibold tabular-nums ${cls}`}
            >
              {formatCurrency(sum, currency, fmtLocale)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
