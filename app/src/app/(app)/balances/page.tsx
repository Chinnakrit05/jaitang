import { requireSession } from "@/lib/session";
import { computeLedgerBalances } from "@/lib/splits";
import { BalancesPanel } from "@/components/balances-panel";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function BalancesPage() {
  const [{ ledgerId, userId, ledger }, t] = await Promise.all([
    requireSession(),
    getTranslations(),
  ]);

  if (ledger.is_personal) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("balances.title")}</h1>
          <p className="text-sm text-(--muted) mt-1">{t("balances.subtitleSharedOnly")}</p>
        </div>
        <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
          <span className="text-4xl mb-3 block">👥</span>
          <p className="font-medium mb-1">{t("balances.personalEmptyTitle")}</p>
          <p className="text-sm text-(--muted) mb-4">{t("balances.personalEmptyHint")}</p>
          <Link
            href="/ledgers"
            className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm"
          >
            {t("balances.switchLedger")}
          </Link>
        </div>
      </div>
    );
  }

  const balances = await computeLedgerBalances(ledgerId);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {ledger.icon ?? "👥"} {t("balances.title")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">
          {t("balances.subtitleShared", { name: ledger.name })}
        </p>
      </div>

      <BalancesPanel
        balances={balances}
        currentUserId={userId}
        currency={ledger.currency}
      />
    </div>
  );
}
