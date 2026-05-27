import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listLedgersForUser } from "@/lib/ledgers";
import { CategoryManager } from "@/components/category-manager";
import { getTranslations } from "next-intl/server";

export default async function CategoriesPage() {
  const { ledgerId, userId } = await requireSession();
  const [categories, allLedgers] = await Promise.all([
    listCategories(ledgerId),
    listLedgersForUser(userId),
  ]);
  // Source list = every ledger the user has read on, minus the active
  // one (you can't copy from yourself).
  const otherLedgers = allLedgers
    .filter((l) => l.id !== ledgerId)
    .map((l) => ({
      id: l.id,
      name: l.name,
      icon: l.icon,
      isPersonal: l.is_personal,
    }));
  const t = await getTranslations();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("categories.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("categories.subtitle")}</p>
      </div>

      <CategoryManager initial={categories} otherLedgers={otherLedgers} />
    </div>
  );
}
