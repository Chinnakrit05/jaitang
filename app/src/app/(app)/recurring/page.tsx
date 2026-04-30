import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listRecurring } from "@/lib/recurring";
import { RecurringPanel } from "@/components/recurring-panel";
import { getTranslations } from "next-intl/server";

export default async function RecurringPage() {
  const { ledgerId } = await requireSession();
  const t = await getTranslations();
  const [rules, categories] = await Promise.all([
    listRecurring(ledgerId),
    listCategories(ledgerId),
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("recurring.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("recurring.subtitle")}</p>
      </div>
      <RecurringPanel rules={rules} categories={categories} />
    </div>
  );
}
