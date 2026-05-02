import Link from "next/link";
import { Plus, Archive, Wallet, ArrowLeftRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listAccounts } from "@/lib/accounts";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { AccountCard } from "@/components/account-card";
import { CreateAccountForm } from "@/components/create-account-form";

export default async function AccountsPage() {
  const [{ ledgerId, ledger }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  const accounts = await listAccounts(ledgerId, { includeArchived: true });
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  // Sum only the home-currency accounts for the footer hint — mixing
  // currencies in a single number would be misleading without an FX
  // pass, and the dashboard currency toggle covers that case anyway.
  const homeCurrencyTotal = active
    .filter((a) => (a.currency ?? ledger.currency) === ledger.currency)
    .reduce((s, a) => s + a.balance, 0);
  const hasForeign = active.some(
    (a) => (a.currency ?? ledger.currency) !== ledger.currency
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={22} className="text-(--accent)" />
            {t("accounts.title")}
          </h1>
          <p className="text-sm text-(--muted) mt-1">{t("accounts.subtitle")}</p>
        </div>
        {active.length >= 2 && (
          <Link
            href="/transfers/new"
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition"
          >
            <ArrowLeftRight size={14} />
            <span className="hidden sm:inline">{t("transfers.newButton")}</span>
          </Link>
        )}
      </div>

      {/* Active accounts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
          {t("accounts.activeSection", { count: active.length })}
        </h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 p-8 text-center">
            <div className="mx-auto mb-3 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-(--background) border border-(--border)">
              <span className="text-2xl" aria-hidden>
                💰
              </span>
            </div>
            <p className="text-sm text-(--muted)">{t("accounts.activeEmpty")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                ledgerCurrency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Create form */}
      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Plus size={16} />
          {t("accounts.createTitle")}
        </h2>
        <p className="text-sm text-(--muted)">{t("accounts.createHint")}</p>
        <CreateAccountForm ledgerCurrency={ledger.currency} />
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide flex items-center gap-2">
            <Archive size={14} />
            {t("accounts.archivedSection", { count: archived.length })}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archived.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                ledgerCurrency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Footer hint */}
      {active.length > 0 && (
        <p className="text-xs text-(--muted)">
          {t("accounts.footerHint", {
            sum: formatCurrency(homeCurrencyTotal, ledger.currency, fmtLocale),
          })}
          {hasForeign && ` ${t("accounts.foreignNote")}`}
        </p>
      )}

      <p className="text-xs text-(--muted)">
        <Link
          href="/transactions"
          className="hover:text-(--foreground) underline"
        >
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}
