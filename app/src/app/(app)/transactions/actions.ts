"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/transactions";
import { equalSplit, replaceSplits } from "@/lib/splits";
import { sendToUsers } from "@/lib/push";
import { listMembers } from "@/lib/members";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { getLocale, getTranslations } from "next-intl/server";
import { fetchFxRate } from "@/lib/fx";
import { SUPPORTED_CODES } from "@/lib/currencies";

/**
 * Confirm a tripId actually belongs to the active ledger. Without this
 * a malicious form submission could attach a transaction to someone
 * else's trip across ledgers.
 */
async function validateTripBelongsToLedger(
  tripId: string,
  ledgerId: string
): Promise<boolean> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  return !!data;
}

/**
 * Same shape as the trip check — confirm the account belongs to the
 * caller's ledger. Returns the account currency on success so we can
 * also validate the tx currency matches the account currency (which is
 * a soft requirement: balance math skips mismatched rows).
 */
async function getAccountForLedger(
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

const TxSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0").max(1e12),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(["cash", "transfer"]).nullable().optional(),
  tripId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  /**
   * The currency the user typed `amount` in. When != ledger.currency we
   * convert + store fx_currency / fx_amount / fx_rate. When equal (or
   * absent), `amount` IS already home currency and fx fields stay null.
   */
  fxCurrency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
    .optional(),
  // Must include a TZ designator (`Z` or `±HH:MM`). Without one, the server
  // would reinterpret the string in UTC and store an instant N hours off
  // from what the user actually typed. The form converts before submitting;
  // this validator catches stale clients or out-of-band callers.
  occurredAt: z.iso.datetime({ offset: true }),
});

/**
 * Resolve the (amount, fx_*) trio for storage given what the user typed
 * and the chosen currency. Returns home-currency `amount` plus the
 * three fx fields (all null when user typed in home currency).
 *
 * Rate is fetched server-side at submit time (not from the client preview)
 * so a stale rate from a 30-second-old preview can't be exploited.
 */
async function resolveFxFields(
  enteredAmount: number,
  fxCurrency: string | undefined,
  homeCurrency: string
): Promise<
  | {
      amount: number;
      fx: { currency: string; amount: number; rate: number } | null;
    }
  | { error: string }
> {
  if (!fxCurrency || fxCurrency === homeCurrency) {
    return { amount: enteredAmount, fx: null };
  }
  try {
    const rate = await fetchFxRate(fxCurrency, homeCurrency);
    const homeAmount = Math.round(enteredAmount * rate * 100) / 100;
    return {
      amount: homeAmount,
      fx: { currency: fxCurrency, amount: enteredAmount, rate },
    };
  } catch {
    return {
      error:
        "FX rate unavailable — please retry, switch back to home currency, or save and edit the rate later",
    };
  }
}

function refreshAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/balances");
  revalidatePath("/accounts");
}

/**
 * Read split-with user ids from formData. Form sends `splitWith` as a comma-separated
 * list of user ids when the "หารบิล" toggle is on. The payer is included in that list
 * (they carry their own share implicitly), so we strip them before persisting splits —
 * we only store rows for users who OWE the payer.
 */
function readSplitWith(formData: FormData, payerId: string): string[] | null {
  const raw = formData.get("splitWith");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  return ids.filter((id) => id !== payerId);
}

export async function createTransactionAction(formData: FormData) {
  const { userId, ledgerId } = await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    paymentMethod: formData.get("paymentMethod") || null,
    tripId: formData.get("tripId") || null,
    accountId: formData.get("accountId") || null,
    fxCurrency: formData.get("fxCurrency") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Cross-ledger trip linkage check. If the form was tampered with to
  // attach this row to another ledger's trip, drop the trip silently
  // rather than 500. Defense-in-depth on top of UI gating.
  let tripId = parsed.data.tripId ?? null;
  if (tripId && !(await validateTripBelongsToLedger(tripId, ledgerId))) {
    tripId = null;
  }

  // Same defense for account linkage. Drop on cross-ledger or unknown id.
  let accountId = parsed.data.accountId ?? null;
  if (accountId) {
    const acc = await getAccountForLedger(accountId, ledgerId);
    if (!acc) accountId = null;
  }

  // Resolve home-currency amount + fx fields. We always re-fetch the rate
  // here even though the form's preview already had one — the form's
  // value is just a hint, the source of truth must come from the server.
  const { ledger } = await requireSession();
  const fxResult = await resolveFxFields(
    parsed.data.amount,
    parsed.data.fxCurrency,
    ledger.currency
  );
  if ("error" in fxResult) {
    return { ok: false as const, error: fxResult.error };
  }

  const tx = await createTransaction({
    ledgerId,
    userId,
    categoryId: parsed.data.categoryId ?? null,
    tripId,
    accountId,
    kind: parsed.data.kind,
    amount: fxResult.amount,
    note: parsed.data.note,
    paymentMethod: parsed.data.paymentMethod ?? null,
    fxCurrency: fxResult.fx?.currency ?? null,
    fxAmount: fxResult.fx?.amount ?? null,
    fxRate: fxResult.fx?.rate ?? null,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  // Splits only make sense for expenses
  let splitOthers: string[] = [];
  if (parsed.data.kind === "expense") {
    const otherIds = readSplitWith(formData, userId);
    if (otherIds && otherIds.length > 0) {
      // Equal split among (payer + others), then store only the others' shares
      const allIds = [userId, ...otherIds];
      const shares = equalSplit(parsed.data.amount, allIds);
      const splits = otherIds
        .map((id) => ({ userId: id, amount: shares.get(id) ?? 0 }))
        .filter((s) => s.amount > 0);
      await replaceSplits(tx.id, splits);
      splitOthers = otherIds;
    }
  }

  // Notify other ledger members in shared ledgers (best-effort, non-blocking on errors)
  try {
    const sb = getServerSupabase();
    const { data: ledger } = await sb
      .from("ledgers")
      .select("name, is_personal")
      .eq("id", ledgerId)
      .single();
    if (ledger && !ledger.is_personal) {
      const members = await listMembers(ledgerId);
      const recipients = members
        .map((m) => m.user_id)
        .filter((id) => id !== userId);
      if (recipients.length > 0) {
        const sign = parsed.data.kind === "income" ? "+" : "−";
        const t = await getTranslations();
        const fmtLocale = intlLocale(await getLocale());
        const amountStr = formatCurrency(parsed.data.amount, "THB", fmtLocale);
        const title = t("push.txNewTitle", { ledger: ledger.name });
        const body =
          splitOthers.length > 0
            ? t("push.txSplitBody", {
                sign,
                amount: amountStr,
                count: splitOthers.length + 1,
              })
            : parsed.data.note
            ? t("push.txBodyWithNote", { sign, amount: amountStr, note: parsed.data.note })
            : t("push.txBody", { sign, amount: amountStr });
        await sendToUsers(recipients, {
          title,
          body,
          url: "/transactions",
          tag: `tx-${tx.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[push] notify on create failed:", err);
  }

  refreshAll();
  redirect("/transactions");
}

export async function updateTransactionAction(id: string, formData: FormData) {
  // requireSession() is React-cached so calling it twice in this function
  // (once for userId, once for ledgerId) is free — we just consolidate.
  const { userId, ledgerId, ledger } = await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    paymentMethod: formData.get("paymentMethod") || null,
    tripId: formData.get("tripId") || null,
    accountId: formData.get("accountId") || null,
    fxCurrency: formData.get("fxCurrency") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let tripId = parsed.data.tripId ?? null;
  if (tripId && !(await validateTripBelongsToLedger(tripId, ledgerId))) {
    tripId = null;
  }

  let accountId = parsed.data.accountId ?? null;
  if (accountId) {
    const acc = await getAccountForLedger(accountId, ledgerId);
    if (!acc) accountId = null;
  }

  // Same FX resolution as create — keep amount in home currency, store
  // the foreign-currency original alongside.
  const fxResult = await resolveFxFields(
    parsed.data.amount,
    parsed.data.fxCurrency,
    ledger.currency
  );
  if ("error" in fxResult) {
    return { ok: false as const, error: fxResult.error };
  }

  await updateTransaction(id, {
    kind: parsed.data.kind,
    amount: fxResult.amount,
    categoryId: parsed.data.categoryId ?? null,
    note: parsed.data.note ?? null,
    paymentMethod: parsed.data.paymentMethod ?? null,
    tripId,
    accountId,
    fxCurrency: fxResult.fx?.currency ?? null,
    fxAmount: fxResult.fx?.amount ?? null,
    fxRate: fxResult.fx?.rate ?? null,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  // Re-write splits to match the (possibly new) amount + member set
  if (parsed.data.kind === "expense") {
    const otherIds = readSplitWith(formData, userId);
    if (otherIds && otherIds.length > 0) {
      const allIds = [userId, ...otherIds];
      const shares = equalSplit(parsed.data.amount, allIds);
      const splits = otherIds
        .map((memberId) => ({ userId: memberId, amount: shares.get(memberId) ?? 0 }))
        .filter((s) => s.amount > 0);
      await replaceSplits(id, splits);
    } else {
      await replaceSplits(id, []);
    }
  } else {
    await replaceSplits(id, []);
  }

  refreshAll();
  redirect("/transactions");
}

export async function deleteTransactionAction(id: string) {
  await requireSession();
  await deleteTransaction(id);
  refreshAll();
}
