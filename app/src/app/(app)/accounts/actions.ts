"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertWritable, requireSession } from "@/lib/session";
import { createAccount, deleteAccount, updateAccount } from "@/lib/accounts";
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
