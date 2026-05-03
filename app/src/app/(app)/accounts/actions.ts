"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertWritable, requireSession } from "@/lib/session";
import { createAccount, deleteAccount, updateAccount } from "@/lib/accounts";
import { createTransaction } from "@/lib/transactions";
import { createTransfer, deleteTransfer } from "@/lib/transfers";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchFxRate } from "@/lib/fx";
import { SUPPORTED_CODES } from "@/lib/currencies";

function refresh() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

const ACCOUNT_TYPES = ["cash", "bank", "credit_card", "e_wallet"] as const;

const CreateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  initialBalance: z.coerce.number().max(1e12).default(0),
  currency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
    .optional(),
});

export async function createAccountAction(formData: FormData) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = CreateAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance") || 0,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const account = await createAccount({
    ledgerId,
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon,
    color: parsed.data.color,
    initialBalance: parsed.data.initialBalance,
    currency: parsed.data.currency ?? null,
  });
  refresh();
  redirect(`/accounts/${account.id}`);
}

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  initialBalance: z.coerce.number().max(1e12),
  currency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
    .optional(),
});

export async function updateAccountDetailsAction(
  accountId: string,
  formData: FormData
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = UpdateAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    initialBalance: formData.get("initialBalance"),
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await updateAccount(accountId, ledgerId, {
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    initialBalance: parsed.data.initialBalance,
    currency: parsed.data.currency ?? null,
  });
  refresh();
  return { ok: true as const };
}

export async function archiveAccountAction(accountId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateAccount(accountId, ledgerId, { archived: true });
  refresh();
}

export async function unarchiveAccountAction(accountId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateAccount(accountId, ledgerId, { archived: false });
  refresh();
}

export async function deleteAccountAction(accountId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteAccount(accountId, ledgerId);
  refresh();
  redirect("/accounts");
}

const TransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  fromAmount: z.coerce.number().positive().max(1e12),
  /** Optional: when set, server uses it (already-converted) instead of
   *  re-fetching FX. Useful for Wise-style transfers where the user wants
   *  to record the actual received amount, not the API-quoted one. */
  toAmount: z.coerce.number().positive().max(1e12).optional(),
  note: z.string().max(500).optional(),
  occurredAt: z.iso.datetime({ offset: true }),
});

/**
 * Validate that an account belongs to the given ledger. Defends
 * against hand-crafted form payloads pointing at someone else's
 * accounts (the form gates this in UI, but the server is authoritative).
 */
async function validateAccountInLedger(
  accountId: string,
  ledgerId: string
): Promise<{ id: string; currency: string | null } | null> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("accounts")
    .select("id, currency")
    .eq("id", accountId)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  return data;
}

async function getLedgerCurrency(ledgerId: string): Promise<string> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("ledgers")
    .select("currency")
    .eq("id", ledgerId)
    .maybeSingle();
  return (data?.currency as string) ?? "THB";
}

export async function createTransferAction(formData: FormData) {
  const { userId, ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = TransferSchema.safeParse({
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    fromAmount: formData.get("fromAmount"),
    toAmount: formData.get("toAmount") || undefined,
    note: formData.get("note") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  if (parsed.data.fromAccountId === parsed.data.toAccountId) {
    return { ok: false as const, error: "From and To must differ" };
  }

  const [from, to] = await Promise.all([
    validateAccountInLedger(parsed.data.fromAccountId, ledgerId),
    validateAccountInLedger(parsed.data.toAccountId, ledgerId),
  ]);
  if (!from || !to) {
    return { ok: false as const, error: "Account not found in this ledger" };
  }

  const home = await getLedgerCurrency(ledgerId);
  const fromCurrency = from.currency ?? home;
  const toCurrency = to.currency ?? home;

  // Same-currency transfers don't need an FX hit.
  let toAmount: number;
  let fxRate: number;
  if (fromCurrency === toCurrency) {
    toAmount = parsed.data.toAmount ?? parsed.data.fromAmount;
    fxRate = 1;
  } else if (parsed.data.toAmount !== undefined) {
    // User supplied the received amount explicitly (e.g. Wise quote
    // they actually got, including fees). Use it as truth and back
    // out the implied rate.
    toAmount = parsed.data.toAmount;
    fxRate = toAmount / parsed.data.fromAmount;
  } else {
    // Fall back to a fresh API rate.
    try {
      const rate = await fetchFxRate(fromCurrency, toCurrency);
      fxRate = rate;
      toAmount = parsed.data.fromAmount * rate;
    } catch {
      return {
        ok: false as const,
        error:
          "FX rate unavailable — enter the received amount manually and retry",
      };
    }
  }

  await createTransfer({
    ledgerId,
    userId,
    fromAccountId: parsed.data.fromAccountId,
    toAccountId: parsed.data.toAccountId,
    fromAmount: parsed.data.fromAmount,
    fromCurrency,
    toAmount,
    toCurrency,
    fxRate,
    note: parsed.data.note ?? null,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  refresh();
  redirect("/accounts");
}

export async function deleteTransferAction(transferId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteTransfer(transferId, ledgerId);
  refresh();
}

// ============================================================
// Account reconciliation
// ============================================================
const ReconcileSchema = z.object({
  asOf: z.iso.datetime({ offset: true }),
  expectedBalance: z.coerce.number().max(1e12),
});

/**
 * Compute the diff between the user-entered "actual bank balance" and
 * the system's computed balance as of a given date. Optionally creates
 * an adjustment transaction so they line up.
 *
 * Two-step UX from the client:
 *   1. POST with `commit=false` → returns { diff, computed }, no tx
 *      created. Client shows the diff for confirmation.
 *   2. POST with `commit=true` → creates the adjustment tx and returns
 *      the same diff so the UI can show "fixed".
 *
 * Foreign-currency accounts: the diff is computed in account-native
 * currency; we re-fetch the FX rate at submit time to derive the
 * home-currency `amount` for the tx. Same all-or-none rule as regular
 * tx — store fx_currency / fx_amount / fx_rate together.
 */
export async function reconcileAccountAction(
  accountId: string,
  formData: FormData
): Promise<
  | {
      ok: true;
      computed: number;
      expected: number;
      diff: number;
      currency: string;
      committed: boolean;
    }
  | { ok: false; error: string }
> {
  const { ledgerId, userId, ledger, role } = await requireSession();
  assertWritable(role);

  const parsed = ReconcileSchema.safeParse({
    asOf: formData.get("asOf"),
    expectedBalance: formData.get("expectedBalance"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const commit = formData.get("commit") === "true";

  const sb = getServerSupabase();

  // Verify the account belongs to this ledger.
  const { data: acc } = await sb
    .from("accounts")
    .select("id, currency, initial_balance")
    .eq("id", accountId)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (!acc) {
    return { ok: false, error: "Account not found in this ledger" };
  }
  const accountCurrency = (acc.currency as string) ?? ledger.currency;

  const asOfISO = parsed.data.asOf;
  const asOf = new Date(asOfISO);

  // Pull tx + transfers up to and including asOf, compute balance.
  const [txRes, transfersRes] = await Promise.all([
    sb
      .from("transactions")
      .select("kind, amount, fx_currency, fx_amount, occurred_at")
      .eq("ledger_id", ledgerId)
      .eq("account_id", accountId)
      .lte("occurred_at", asOfISO),
    sb
      .from("transfers")
      .select("from_account_id, to_account_id, from_amount, to_amount")
      .eq("ledger_id", ledgerId)
      .lte("occurred_at", asOfISO)
      .or(
        `from_account_id.eq.${accountId},to_account_id.eq.${accountId}`
      ),
  ]);
  if (txRes.error) return { ok: false, error: txRes.error.message };
  if (transfersRes.error) return { ok: false, error: transfersRes.error.message };

  let computed = Number(acc.initial_balance);
  for (const tx of txRes.data ?? []) {
    // Same logic as listAccounts: skip currency-mismatched rows.
    const native =
      tx.fx_currency === accountCurrency && tx.fx_amount !== null
        ? Number(tx.fx_amount)
        : !tx.fx_currency
        ? Number(tx.amount)
        : null;
    if (native === null) continue;
    if (tx.kind === "income") computed += native;
    else computed -= native;
  }
  for (const tr of transfersRes.data ?? []) {
    if (tr.from_account_id === accountId) computed -= Number(tr.from_amount);
    if (tr.to_account_id === accountId) computed += Number(tr.to_amount);
  }

  // Round to 2 decimals so micro-cent FP drift doesn't cause spurious
  // ฿0.01 adjustments.
  computed = Math.round(computed * 100) / 100;
  const expected = Math.round(parsed.data.expectedBalance * 100) / 100;
  const diff = Math.round((expected - computed) * 100) / 100;

  if (!commit || diff === 0) {
    return {
      ok: true,
      computed,
      expected,
      diff,
      currency: accountCurrency,
      committed: false,
    };
  }

  // Commit: create an adjustment tx. For foreign accounts, fetch the FX
  // rate to derive the home-currency `amount`. fx_amount is the native
  // diff (always positive — kind sign carries direction).
  const native = Math.abs(diff);
  let amount = native;
  let fxFields: {
    fxCurrency: string | null;
    fxAmount: number | null;
    fxRate: number | null;
  } = { fxCurrency: null, fxAmount: null, fxRate: null };
  if (accountCurrency !== ledger.currency) {
    try {
      const rate = await fetchFxRate(accountCurrency, ledger.currency);
      amount = Math.round(native * rate * 100) / 100;
      fxFields = {
        fxCurrency: accountCurrency,
        fxAmount: native,
        fxRate: rate,
      };
    } catch {
      return {
        ok: false,
        error:
          "FX rate unavailable — try again later or do the adjustment manually.",
      };
    }
  }

  await createTransaction({
    ledgerId,
    userId,
    categoryId: null,
    accountId,
    kind: diff > 0 ? "income" : "expense",
    amount,
    note: "[Reconciliation]",
    fxCurrency: fxFields.fxCurrency,
    fxAmount: fxFields.fxAmount,
    fxRate: fxFields.fxRate,
    occurredAt: asOfISO,
  });

  refresh();
  return {
    ok: true,
    computed,
    expected,
    diff,
    currency: accountCurrency,
    committed: true,
  };
}
