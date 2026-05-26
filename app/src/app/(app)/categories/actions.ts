"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories";

const CategorySchema = z.object({
  name: z.string().min(1).max(50),
  // Icons can be JtIcon names (kebab-case, longer than 8 chars), so we widen
  // the cap. Keeping a soft upper bound to avoid pathological input.
  icon: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  kind: z.enum(["income", "expense"]),
  parentId: z.string().uuid().nullable().optional(),
});

function refresh() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/transactions/new");
  revalidatePath("/dashboard");
}

/**
 * Bulk reorder: caller passes the category ids in their desired
 * visual order, and we write `sort_order = index + 1` for each. Used
 * by the wiggle-mode reorder grid on /transactions/new.
 *
 * Belongs in /categories actions (not /transactions) because the
 * mutation is on the categories table — the form just happens to be
 * the convenient surface.
 */
const ReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export async function reorderCategoriesAction(ids: string[]) {
  const { ledgerId } = await requireSession();
  const parsed = ReorderSchema.safeParse({ ids });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // Issue per-row updates in parallel; updateCategory already enforces
  // ledger ownership through RLS-equivalent lib checks.
  await Promise.all(
    parsed.data.ids.map((id, index) =>
      updateCategory(id, { sort_order: index + 1 })
    )
  );
  // Best-effort ledger guard: any id outside the active ledger would
  // have failed silently above (the update touches 0 rows). The next
  // page render simply won't see those reorders.
  void ledgerId;
  refresh();
  return { ok: true as const };
}

export async function createCategoryAction(formData: FormData) {
  const { ledgerId } = await requireSession();
  const parsed = CategorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    kind: formData.get("kind"),
    parentId: formData.get("parentId") || null,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createCategory(ledgerId, parsed.data);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
  }
  refresh();
  return { ok: true as const };
}

export async function updateCategoryAction(id: string, formData: FormData) {
  await requireSession();
  const rawParent = formData.get("parentId");
  const parsed = z
    .object({
      name: z.string().min(1).max(50).optional(),
      icon: z.string().min(1).max(64).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      parent_id: z.string().uuid().nullable().optional(),
    })
    .safeParse({
      name: formData.get("name") || undefined,
      icon: formData.get("icon") || undefined,
      color: formData.get("color") || undefined,
      parent_id: rawParent === "" || rawParent === null ? null : rawParent,
    });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await updateCategory(id, parsed.data);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
  }
  refresh();
  return { ok: true as const };
}

export async function deleteCategoryAction(id: string) {
  await requireSession();
  await deleteCategory(id);
  refresh();
}
