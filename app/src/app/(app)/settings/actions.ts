"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { assertOwner, requireSession } from "@/lib/session";
import { saveSubscription, deleteSubscription } from "@/lib/push";
import { wipeLedgerTransactions } from "@/lib/transactions";
import { wipeAllUserData, type WipeUserSummary } from "@/lib/account";

export async function subscribePushAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const { userId } = await requireSession();
  await saveSubscription({
    userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent,
  });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function unsubscribePushAction(endpoint: string) {
  const { userId } = await requireSession();
  await deleteSubscription({ userId, endpoint });
  revalidatePath("/settings");
}

/**
 * Wipe all transactions in the user's currently active ledger.
 * Owner-only — for a shared ledger you joined as editor/viewer, you can't
 * nuke other members' history.
 */
export async function wipeActiveLedgerTransactionsAction(): Promise<{
  ok: true;
  count: number;
  ledgerName: string;
} | { ok: false; error: string }> {
  const { ledgerId, ledger, role } = await requireSession();
  try {
    assertOwner(role);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ไม่มีสิทธิ์",
    };
  }
  const count = await wipeLedgerTransactions(ledgerId);
  // Every page that aggregates transactions needs to forget what it cached.
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/balances");
  revalidatePath("/budgets");
  revalidatePath("/settings");
  return { ok: true, count, ledgerName: ledger.name };
}

/**
 * Wipe every owned ledger + push subscription and sign the user out.
 * On next sign-in, `ensurePersonalLedger` recreates a fresh personal ledger.
 *
 * The action ends in a redirect, so it never returns to the caller — the
 * `WipeUserSummary` shape is here only so the function is statically typed
 * for callers that want to inspect it before the navigation kicks in.
 */
export async function wipeAllMyDataAction(): Promise<WipeUserSummary> {
  const { userId } = await requireSession();
  const summary = await wipeAllUserData(userId);
  // The active-ledger cookie may still point at the personal ledger we just
  // deleted. resolveActiveLedger() validates the cookie before trusting it,
  // so a stale value would fall back gracefully — but clearing it explicitly
  // means the next sign-in lands on a fresh personal ledger without a
  // detour through the validation miss.
  const store = await cookies();
  store.delete("jt_active_ledger");
  await signOut({ redirect: false });
  redirect("/");
  // Unreachable, but keeps TS happy
  return summary;
}
