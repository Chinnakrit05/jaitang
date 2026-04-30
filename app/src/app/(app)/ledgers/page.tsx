import { listLedgersForUser } from "@/lib/ledgers";
import { requireSession } from "@/lib/session";
import { LedgerCard } from "@/components/ledger-card";
import { CreateLedgerForm } from "@/components/create-ledger-form";
import { getTranslations } from "next-intl/server";

export default async function LedgersPage() {
  const { userId, ledgerId: activeLedgerId } = await requireSession();
  const ledgers = await listLedgersForUser(userId);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("ledgers.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("ledgers.subtitle")}</p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ledgers.map((l) => (
          <LedgerCard key={l.id} ledger={l} isActive={l.id === activeLedgerId} />
        ))}
      </ul>

      <CreateLedgerForm />

      <p className="text-xs text-(--muted)">
        {t.rich("ledgers.joinHint", {
          pattern: () => (
            <code className="px-1 py-0.5 rounded bg-(--card) border border-(--border)">
              /invite/&lt;code&gt;
            </code>
          ),
        })}
      </p>
    </div>
  );
}
