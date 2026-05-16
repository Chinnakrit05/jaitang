import { getServerSupabase } from "@/lib/supabase/server";
import type { Account, AccountType } from "@/lib/types";

export type AccountWithBalance = Account & {
  /** Current balance in the account's own currency. */
  balance: number;
  /** Number of transactions tagged to this account. */
  txCount: number;
  /** Number of transfers touching this account (in OR out). */
  transferCount: number;
};

/**
 * List accounts in a ledger with current balances computed in JS.
 *
 * Balance formula:
 *   initial_balance
 *     + Σ(income tx.fx_amount or .amount, in account currency)
 *     - Σ(expense tx.fx_amount or .amount, in account currency)
 *     + Σ(transfer.to_amount where to_account = X)
 *     - Σ(transfer.from_amount where from_account = X)
 *
 * For tx amounts: when tx.fx_currency matches account.currency we
 * use fx_amount (the native value the user typed); otherwise we use
 * `amount` which is in the ledger's home currency. Mismatched
 * currency rows are excluded from the balance — the form should
 * prevent that pairing in the first place.
 */
export async function listAccounts(
  ledgerId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<AccountWithBalance[]> {
  const sb = getServerSupabase();

  let q = sb
    .from("accounts")
    .select(
      "id, ledger_id, name, type, icon, color, initial_balance, currency, archived, created_at"
    )
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null);
  if (!opts.includeArchived) q = q.eq("archived", false);
  q = q
    .order("archived", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: accounts, error } = await q;
  if (error) throw error;
  if (!accounts || accounts.length === 0) return [];

  const ids = accounts.map((a) => a.id);

  // Pull all tx + transfers in a single roundtrip pair
  const [txRes, transfersRes] = await Promise.all([
    sb
      .from("transactions")
      .select("account_id, kind, amount, fx_currency, fx_amount")
      .in("account_id", ids)
      .is("deleted_at", null),
    sb
      .from("transfers")
      .select("from_account_id, to_account_id, from_amount, to_amount")
      .or(
        `from_account_id.in.(${ids.join(",")}),to_account_id.in.(${ids.join(",")})`
      ),
  ]);
  if (txRes.error) throw txRes.error;
  if (transfersRes.error) throw transfersRes.error;

  // Quick lookup of (id → currency) so we know which side to pull
  // for each transaction.
  const accCurrency = new Map<string, string>();
  // Resolve "default" currency for null-currency accounts at runtime
  const ledgerCurrency = await getLedgerCurrency(ledgerId);
  for (const a of accounts) {
    accCurrency.set(a.id, a.currency ?? ledgerCurrency);
  }

  const stats = new Map<
    string,
    { balance: number; txCount: number; transferCount: number }
  >();
  for (const a of accounts) {
    stats.set(a.id, {
      balance: Number(a.initial_balance),
      txCount: 0,
      transferCount: 0,
    });
  }

  for (const tx of txRes.data ?? []) {
    if (!tx.account_id) continue;
    const s = stats.get(tx.account_id);
    const acur = accCurrency.get(tx.account_id);
    if (!s || !acur) continue;
    s.txCount += 1;
    // Use fx_amount when tx is in the same currency as the account
    // (the user typed it natively); otherwise fall back to the
    // home-currency `amount`. Same-currency case covers most rows.
    const native =
      tx.fx_currency === acur && tx.fx_amount !== null
        ? Number(tx.fx_amount)
        : !tx.fx_currency
        ? Number(tx.amount)
        : null;
    if (native === null) continue; // currency mismatch — skip
    if (tx.kind === "income") s.balance += native;
    else s.balance -= native;
  }

  for (const tr of transfersRes.data ?? []) {
    if (tr.from_account_id && stats.has(tr.from_account_id)) {
      const s = stats.get(tr.from_account_id)!;
      s.transferCount += 1;
      s.balance -= Number(tr.from_amount);
    }
    if (tr.to_account_id && stats.has(tr.to_account_id)) {
      const s = stats.get(tr.to_account_id)!;
      s.transferCount += 1;
      s.balance += Number(tr.to_amount);
    }
  }

  return accounts.map((a) => {
    const s = stats.get(a.id) ?? { balance: 0, txCount: 0, transferCount: 0 };
    return {
      ...a,
      type: a.type as AccountType,
      initial_balance: Number(a.initial_balance),
      balance: s.balance,
      txCount: s.txCount,
      transferCount: s.transferCount,
    };
  });
}

export async function getAccount(
  accountId: string,
  ledgerId: string
): Promise<AccountWithBalance | null> {
  // Cheap path: just call listAccounts and find the row. Trades a
  // minor extra fetch for code simplicity — `listAccounts` is the
  // canonical source of balance math.
  const all = await listAccounts(ledgerId, { includeArchived: true });
  return all.find((a) => a.id === accountId) ?? null;
}

export async function createAccount(input: {
  ledgerId: string;
  name: string;
  type: AccountType;
  icon?: string;
  color?: string;
  initialBalance?: number;
  currency?: string | null;
}): Promise<Account> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("accounts")
    .insert({
      ledger_id: input.ledgerId,
      name: input.name,
      type: input.type,
      icon: input.icon ?? null,
      color: input.color ?? null,
      initial_balance: input.initialBalance ?? 0,
      currency: input.currency ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    type: data.type as AccountType,
    initial_balance: Number(data.initial_balance),
  } as Account;
}

export async function updateAccount(
  accountId: string,
  ledgerId: string,
  patch: Partial<{
    name: string;
    type: AccountType;
    icon: string | null;
    color: string | null;
    initialBalance: number;
    currency: string | null;
    archived: boolean;
  }>
): Promise<Account> {
  const sb = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.initialBalance !== undefined)
    update.initial_balance = patch.initialBalance;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.archived !== undefined) update.archived = patch.archived;

  const { data, error } = await sb
    .from("accounts")
    .update(update)
    .eq("id", accountId)
    .eq("ledger_id", ledgerId)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    type: data.type as AccountType,
    initial_balance: Number(data.initial_balance),
  } as Account;
}

/**
 * Delete an account. Transactions tagged with this account get their
 * `account_id` set to null (FK is `on delete set null`); transfers
 * with this account on either side cascade-delete (FK is `on delete
 * cascade`) — losing transfer history is acceptable since transfers
 * are inherently "between two accounts" and lose meaning if one is
 * gone.
 */
export async function deleteAccount(
  accountId: string,
  ledgerId: string
): Promise<void> {
  const sb = getServerSupabase();
  // Soft delete so offline mobile clients see the tombstone on their
  // next pull. The FK behaviors (`set null` on transactions, `cascade`
  // on transfers) no longer fire — but listAccounts filters out
  // deleted rows, so the account simply disappears from the UI, and
  // the lingering FK pointers stay valid until they're recomputed.
  const { error } = await sb
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}

async function getLedgerCurrency(ledgerId: string): Promise<string> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("ledgers")
    .select("currency")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data?.currency as string) ?? "THB";
}
