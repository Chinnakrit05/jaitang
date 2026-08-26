import Link from "next/link";
import { JtIcon, EmojiOrIcon } from "@/components/icons";

import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";
import type { AccountWithBalance } from "@/lib/accounts";

/**
 * Compact account balances widget for the dashboard. Shows up to N
 * non-archived accounts (default 4) as small chips with their balance,
 * plus a "view all" CTA. Foreign-currency accounts render in their own
 * currency; the home-currency total is summed separately on the right.
 *
 * Server component — pulls translations directly. Pass `accounts`
 * already filtered to non-archived from the dashboard page.
 */
export async function DashboardAccountBalances({
  accounts,
  homeCurrency,
  fmtLocale,
  limit = 4,
}: {
  accounts: AccountWithBalance[];
  homeCurrency: string;
  fmtLocale: string;
  limit?: number;
}) {
  const t = await getTranslations();

  if (accounts.length === 0) {
    return (
      <section className="rounded-[22px] soft-well p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <JtIcon name="accounts" size={22} className="text-(--muted)" />
            <h2 className="font-semibold text-sm">
              {t("accounts.dashboardHeading")}
            </h2>
          </div>
          <Link
            href="/accounts"
            className="text-sm text-(--accent) hover:underline inline-flex items-center gap-1"
          >
            {t("accounts.dashboardCtaCreate")}
            <JtIcon name="chevron-right" size={18} />
          </Link>
        </div>
        <p className="text-xs text-(--muted) mt-2">
          {t("accounts.dashboardEmpty")}
        </p>
      </section>
    );
  }

  // Sort by balance descending so the dashboard surfaces the most
  // important pots first; tie-break alphabetically for stable ordering.
  const sorted = [...accounts].sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.name.localeCompare(b.name);
  });
  const visible = sorted.slice(0, limit);
  const hidden = sorted.length - visible.length;

  // Home-currency-only total for the header. Mixing currencies into a
  // single number would mislead, so we just badge "+N foreign" if any.
  const homeTotal = accounts
    .filter((a) => (a.currency ?? homeCurrency) === homeCurrency)
    .reduce((s, a) => s + a.balance, 0);
  const foreignCount = accounts.filter(
    (a) => (a.currency ?? homeCurrency) !== homeCurrency
  ).length;

  return (
    <section className="rounded-[22px] soft-raised p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <JtIcon name="accounts" size={22} className="text-(--accent)" />
          <h2 className="font-semibold">{t("accounts.dashboardHeading")}</h2>
        </div>
        <Link
          href="/accounts"
          className="text-sm text-(--accent) hover:underline inline-flex items-center gap-1"
        >
          {t("accounts.dashboardCtaAll")}
          <JtIcon name="chevron-right" size={18} />
        </Link>
      </div>

      <div className="text-2xl font-bold tabular-nums mb-1">
        {formatCurrency(homeTotal, homeCurrency, fmtLocale)}
      </div>
      <div className="text-xs text-(--muted) mb-4">
        {t("accounts.dashboardSubtitle", { count: accounts.length })}
        {foreignCount > 0 && (
          <span className="ml-1">
            • {t("accounts.dashboardForeignBadge", { count: foreignCount })}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((a) => {
          const cur = a.currency ?? homeCurrency;
          const balanceColor =
            a.balance < 0
              ? "text-(--expense)"
              : a.balance > 0
              ? "text-(--foreground)"
              : "text-(--muted)";
          return (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className="flex items-center gap-2.5 p-2.5 rounded-[14px] soft-well-sm"
              >
                <span
                  className="text-base shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: a.color
                      ? `${a.color}20`
                      : "var(--card)",
                  }}
                >
                  <EmojiOrIcon value={a.icon} fallback="money-bag" size={24} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div
                    className={`text-xs tabular-nums ${balanceColor}`}
                  >
                    {formatCurrency(a.balance, cur, fmtLocale)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <p className="text-xs text-(--muted) mt-3 text-center">
          {t("accounts.dashboardMore", { count: hidden })}
        </p>
      )}
    </section>
  );
}
