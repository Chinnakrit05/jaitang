import { getServerSupabase } from "@/lib/supabase/server";
import type { Account, Transfer } from "@/lib/types";

export type TransferWithAccounts = Transfer & {
  fromAccount: Pick<Account, "id" | "name" | "icon" | "color"> | null;
  toAccount: Pick<Account, "id" | "name" | "icon" | "color"> | null;
};

export async function createTransfer(input: {
  ledgerId: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  fxRate: number;
  note?: string | null;
  occurredAt?: string;
}): Promise<Transfer> {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Cannot transfer to the same account");
  }
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("transfers")
    .insert({
      ledger_id: input.ledgerId,
      user_id: input.userId,
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      from_amount: input.fromAmount,
      from_currency: input.fromCurrency,
      to_amount: input.toAmount,
      to_currency: input.toCurrency,
      fx_rate: input.fxRate,
      note: input.note ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    from_amount: Number(data.from_amount),
    to_amount: Number(data.to_amount),
    fx_rate: Number(data.fx_rate),
  } as Transfer;
}

/**
 * List transfers touching a given account (either side). Sorted
 * newest-first to feed the account detail timeline. Include resolved
 * from/to account display data so the UI doesn't have to chase ids.
 */
export async function listTransfersForAccount(
  accountId: string,
  ledgerId: string,
  limit = 100
): Promise<TransferWithAccounts[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("transfers")
    .select(
      "id, ledger_id, user_id, from_account_id, to_account_id, from_amount, from_currency, to_amount, to_currency, fx_rate, note, occurred_at, created_at, fromAccount:from_account_id(id, name, icon, color), toAccount:to_account_id(id, name, icon, color)"
    )
    .eq("ledger_id", ledgerId)
    .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    from_amount: Number(row.from_amount),
    to_amount: Number(row.to_amount),
    fx_rate: Number(row.fx_rate),
    fromAccount: Array.isArray(row.fromAccount)
      ? row.fromAccount[0] ?? null
      : (row.fromAccount as TransferWithAccounts["fromAccount"]) ?? null,
    toAccount: Array.isArray(row.toAccount)
      ? row.toAccount[0] ?? null
      : (row.toAccount as TransferWithAccounts["toAccount"]) ?? null,
  }));
}

export async function deleteTransfer(
  transferId: string,
  ledgerId: string
): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("transfers")
    .delete()
    .eq("id", transferId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}
