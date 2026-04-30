import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage() {
  const enabled = !!process.env.ANTHROPIC_API_KEY;
  const [{ ledger }, t] = await Promise.all([
    requireSession(),
    getTranslations(),
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t("import.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("import.subtitle")}</p>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-(--border) bg-(--card) p-6">
          <p className="text-sm text-(--muted)">{t("import.notConfigured")}</p>
        </div>
      ) : (
        <ImportWizard ledgerCurrency={ledger.currency} />
      )}
    </div>
  );
}
