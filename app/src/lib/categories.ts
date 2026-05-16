import { getServerSupabase } from "@/lib/supabase/server";
import type { Category, TxKind } from "@/lib/types";

export async function listCategories(ledgerId: string): Promise<Category[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("categories")
    .select("id, ledger_id, name, icon, color, kind, sort_order, parent_id")
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    parent_id: c.parent_id ?? null,
  })) as Category[];
}

/**
 * Group a flat category list into top-level parents with their subcategories
 * attached. Subs that point to an unknown parent (shouldn't happen with the
 * `on delete set null` constraint, but defend against it) get treated as
 * top-level rather than dropped.
 */
export type CategoryWithChildren = Category & { children: Category[] };

export function nestCategories(flat: Category[]): CategoryWithChildren[] {
  const byId = new Map<string, CategoryWithChildren>();
  const roots: CategoryWithChildren[] = [];

  for (const c of flat) {
    byId.set(c.id, { ...c, children: [] });
  }
  for (const c of flat) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(byId.get(c.id)!);
    } else {
      roots.push(byId.get(c.id)!);
    }
  }
  return roots;
}

/**
 * Re-order a flat category list so each parent is immediately followed by
 * its subs. Useful for rendering dropdowns / lists that don't support
 * nested groups but want to preserve the parent → sub relationship.
 *
 * Generic over the row shape because some callers (e.g. import-wizard) use
 * a `Pick<Category, ...>` projection rather than the full row.
 */
export function sortByHierarchy<T extends { id: string; parent_id: string | null }>(
  flat: T[],
): T[] {
  const subsByParent = new Map<string, T[]>();
  const roots: T[] = [];
  for (const c of flat) {
    if (c.parent_id) {
      if (!subsByParent.has(c.parent_id))
        subsByParent.set(c.parent_id, []);
      subsByParent.get(c.parent_id)!.push(c);
    } else {
      roots.push(c);
    }
  }
  const out: T[] = [];
  for (const root of roots) {
    out.push(root);
    const subs = subsByParent.get(root.id);
    if (subs) out.push(...subs);
  }
  // Subs without a known parent get appended at the end so nothing's lost.
  for (const [parentId, subs] of subsByParent) {
    if (!roots.some((r) => r.id === parentId)) out.push(...subs);
  }
  return out;
}

export async function createCategory(
  ledgerId: string,
  input: {
    name: string;
    icon?: string;
    color?: string;
    kind: TxKind;
    parentId?: string | null;
  },
) {
  const sb = getServerSupabase();
  const { data: maxRow } = await sb
    .from("categories")
    .select("sort_order")
    .eq("ledger_id", ledgerId)
    .eq("kind", input.kind)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  // Validate parent: must be in same ledger, same kind, AND itself top-level
  // (no two-deep nesting).
  if (input.parentId) {
    const { data: parent } = await sb
      .from("categories")
      .select("id, ledger_id, kind, parent_id")
      .eq("id", input.parentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!parent || parent.ledger_id !== ledgerId) {
      throw new Error("Parent category not found in this ledger");
    }
    if (parent.kind !== input.kind) {
      throw new Error("Subcategory kind must match parent");
    }
    if (parent.parent_id !== null) {
      throw new Error("Cannot nest a subcategory under another subcategory");
    }
  }

  const { data, error } = await sb
    .from("categories")
    .insert({
      ledger_id: ledgerId,
      name: input.name,
      icon: input.icon ?? "✨",
      color: input.color ?? "#94a3b8",
      kind: input.kind,
      sort_order: nextOrder,
      parent_id: input.parentId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  input: Partial<
    Pick<Category, "name" | "icon" | "color" | "sort_order" | "parent_id">
  >,
) {
  const sb = getServerSupabase();

  // If the caller is reassigning the parent, validate the same constraints
  // as on insert (same ledger, same kind, parent must be top-level, and we
  // must not parent a category to itself).
  if (input.parent_id !== undefined && input.parent_id !== null) {
    const { data: self } = await sb
      .from("categories")
      .select("id, ledger_id, kind")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!self) throw new Error("Category not found");
    if (input.parent_id === id) {
      throw new Error("Category cannot be its own parent");
    }
    const { data: parent } = await sb
      .from("categories")
      .select("id, ledger_id, kind, parent_id")
      .eq("id", input.parent_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!parent || parent.ledger_id !== self.ledger_id) {
      throw new Error("Parent category not found in this ledger");
    }
    if (parent.kind !== self.kind) {
      throw new Error("Subcategory kind must match parent");
    }
    if (parent.parent_id !== null) {
      throw new Error("Cannot nest a subcategory under another subcategory");
    }
    // If this category has children, blocking it from becoming a sub keeps
    // the depth invariant intact.
    const { count } = await sb
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) {
      throw new Error("Cannot turn a parent category into a subcategory");
    }
  }

  const { data, error } = await sb
    .from("categories")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const sb = getServerSupabase();
  // Soft delete — keeps the row around so offline mobile clients can
  // notice the deletion on their next pull (via the `deleted_at`
  // timestamp landing on a row they already had cached).
  const { error } = await sb
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
