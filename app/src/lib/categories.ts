import { getServerSupabase } from "@/lib/supabase/server";
import type { Category, TxKind } from "@/lib/types";

export async function listCategories(ledgerId: string): Promise<Category[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("categories")
    .select("id, ledger_id, name, icon, color, kind, sort_order")
    .eq("ledger_id", ledgerId)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(
  ledgerId: string,
  input: { name: string; icon?: string; color?: string; kind: TxKind }
) {
  const sb = getServerSupabase();
  const { data: maxRow } = await sb
    .from("categories")
    .select("sort_order")
    .eq("ledger_id", ledgerId)
    .eq("kind", input.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await sb
    .from("categories")
    .insert({
      ledger_id: ledgerId,
      name: input.name,
      icon: input.icon ?? "✨",
      color: input.color ?? "#94a3b8",
      kind: input.kind,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  input: Partial<Pick<Category, "name" | "icon" | "color" | "sort_order">>
) {
  const sb = getServerSupabase();
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
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}
