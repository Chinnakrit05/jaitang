import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { TransactionList } from "@/components/transaction-list";
import { QuickAddPanel } from "@/components/quick-add-panel";

export default async function QuickAddPage() {
  const enabled = !!process.env.ANTHROPIC_API_KEY;

  const [{ ledgerId, ledger }, t] = await Promise.all([
    requireSession(),
    getTranslations(),
  ]);

  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">{t("quick.title")}</h1>
        <div className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <p className="text-sm text-(--muted)">{t("quick.notConfigured")}</p>
        </div>
      </div>
    );
  }

  const recent = await listTransactions({ ledgerId, limit: 5 });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t("quick.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("quick.subtitle")}</p>
      </div>

      <QuickAddPanel />

      <section>
        <h2 className="text-sm font-semibold text-(--muted) mb-2 px-1">
          {t("quick.recent")}
        </h2>
        <TransactionList
          items={recent}
          showAttribution={!ledger.is_personal}
          currency={ledger.currency}
        />
      </section>
    </div>
  );
}
