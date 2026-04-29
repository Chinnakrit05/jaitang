import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { CategoryManager } from "@/components/category-manager";

export default async function CategoriesPage() {
  const { ledgerId } = await requireSession();
  const categories = await listCategories(ledgerId);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">หมวดหมู่</h1>
        <p className="text-sm text-(--muted) mt-1">
          จัดการหมวดสำหรับการบันทึกรายรับ-รายจ่าย
        </p>
      </div>

      <CategoryManager initial={categories} />
    </div>
  );
}
