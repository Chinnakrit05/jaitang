import { getServerSupabase } from "@/lib/supabase/server";

export type Budget = {
  id: string;
  ledger_id: string;
  category_id: string;
  amount: number;
  period: "month";
};

export async function listBudgets(ledgerId: string): Promise<Budget[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("budgets")
    .select("id, ledger_id, category_id, amount, period")
    .eq("ledger_id", ledgerId);
  if (error) throw error;
  return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) }));
}

export async function upsertBudget(opts: {
  ledgerId: string;
  categoryId: string;
  amount: number;
}) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("budgets")
    .upsert(
      {
        ledger_id: opts.ledgerId,
        category_id: opts.categoryId,
        amount: opts.amount,
        period: "month",
      },
      { onConflict: "ledger_id,category_id,period" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function deleteBudget(opts: {
  ledgerId: string;
  categoryId: string;
}) {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("budgets")
    .delete()
    .eq("ledger_id", opts.ledgerId)
    .eq("category_id", opts.categoryId)
    .eq("period", "month");
  if (error) throw error;
}
