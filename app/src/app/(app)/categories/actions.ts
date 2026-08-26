"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import {
  createCategory,
  deleteCategory,
  listCategories,
  restoreCategory,
  updateCategory,
} from "@/lib/categories";
import { getServerSupabase } from "@/lib/supabase/server";

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
  // Soft delete (tombstone) — recoverable via undoDeleteCategoryAction
  // below, which the post-delete toast calls.
  await deleteCategory(id);
  refresh();
}

/**
 * Undo a just-deleted category — clears the soft-delete tombstone.
 * Wired to the "เลิกทำ" toast on /categories so a mistapped confirm
 * no longer costs the category, its subcategories' parent link, and
 * the grouping of every transaction filed under it.
 */
export async function undoDeleteCategoryAction(id: string) {
  const { ledgerId } = await requireSession();
  await restoreCategory(id, ledgerId);
  refresh();
  return { ok: true as const };
}

/**
 * Copy every category from `sourceLedgerId` into the user's active
 * ledger. Skips rows that already exist in the destination by
 * (kind, name) so re-running the action is idempotent.
 *
 * Parents are inserted first; a local id-translation map then lets
 * subcategories point at the freshly-created parent in the
 * destination ledger. Subs whose parent got deduped to an existing
 * destination row reattach to that existing row.
 *
 * Returns counts so the UI can render a friendly summary.
 */
export async function copyCategoriesFromLedgerAction(sourceLedgerId: string) {
  const { userId, ledgerId: destLedgerId } = await requireSession();
  if (sourceLedgerId === destLedgerId) {
    return { ok: false as const, error: "Source and destination are the same ledger" };
  }
  // Validate read access on the source: owner or member.
  const sb = getServerSupabase();
  const { data: srcLedger } = await sb
    .from("ledgers")
    .select("id, owner_id")
    .eq("id", sourceLedgerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!srcLedger) {
    return { ok: false as const, error: "Source ledger not found" };
  }
  if (srcLedger.owner_id !== userId) {
    const { data: member } = await sb
      .from("ledger_members")
      .select("user_id")
      .eq("ledger_id", sourceLedgerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) {
      return { ok: false as const, error: "No access to source ledger" };
    }
  }

  const [sourceCats, destCats] = await Promise.all([
    listCategories(sourceLedgerId),
    listCategories(destLedgerId),
  ]);

  // Dedupe key — same kind + same name reuses the destination's row.
  const destByKey = new Map<string, string>();
  for (const c of destCats) {
    destByKey.set(`${c.kind}::${c.name}`, c.id);
  }

  let copied = 0;
  let skipped = 0;
  // old src id → resolved dest id (newly created OR existing dedupe target)
  const idMap = new Map<string, string>();

  // Parents first so subs can look up their (now-existing) parent.
  const parents = sourceCats.filter((c) => c.parent_id === null);
  const subs = sourceCats.filter((c) => c.parent_id !== null);

  for (const c of parents) {
    const key = `${c.kind}::${c.name}`;
    const existing = destByKey.get(key);
    if (existing) {
      idMap.set(c.id, existing);
      skipped++;
      continue;
    }
    const created = await createCategory(destLedgerId, {
      name: c.name,
      icon: c.icon ?? undefined,
      color: c.color ?? undefined,
      kind: c.kind,
      parentId: null,
    });
    idMap.set(c.id, created.id);
    destByKey.set(key, created.id);
    copied++;
  }

  for (const c of subs) {
    const key = `${c.kind}::${c.name}`;
    if (destByKey.has(key)) {
      idMap.set(c.id, destByKey.get(key)!);
      skipped++;
      continue;
    }
    const mappedParent = c.parent_id ? idMap.get(c.parent_id) ?? null : null;
    const created = await createCategory(destLedgerId, {
      name: c.name,
      icon: c.icon ?? undefined,
      color: c.color ?? undefined,
      kind: c.kind,
      parentId: mappedParent,
    });
    idMap.set(c.id, created.id);
    destByKey.set(key, created.id);
    copied++;
  }

  refresh();
  return { ok: true as const, copied, skipped };
}
