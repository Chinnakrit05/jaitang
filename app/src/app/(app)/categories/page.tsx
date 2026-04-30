import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { CategoryManager } from "@/components/category-manager";
import { getTranslations } from "next-intl/server";

export default async function CategoriesPage() {
  const { ledgerId } = await requireSession();
  const categories = await listCategories(ledgerId);
  const t = await getTranslations();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("categories.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("categories.subtitle")}</p>
      </div>

      <CategoryManager initial={categories} />
    </div>
  );
}
