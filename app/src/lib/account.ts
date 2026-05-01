import { getServerSupabase } from "@/lib/supabase/server";

export type WipeUserSummary = {
  ledgersDeleted: number;
  pushSubscriptionsDeleted: number;
  sharedLedgersKept: number;
};

/**
 * Reset every piece of data this user OWNS. Cascading FKs in the schema
 * mean deleting a ledger row removes its categories, transactions (and their
 * splits), budgets, recurring rules, invites, and member rows in one shot.
 *
 * What this does NOT touch:
 * - shared ledgers where the user is only a member (those belong to someone
 *   else; deleting the user's data inside them would corrupt other members'
 *   bill-split history)
 * - the `users` row itself (Auth.js owns the account; if they sign back in,
 *   `ensurePersonalLedger` will recreate a fresh personal ledger)
 *
 * Callers must authorize: only invoke for the currently signed-in user.
 */
export async function wipeAllUserData(userId: string): Promise<WipeUserSummary> {
  const sb = getServerSupabase();

  // 1) Owned ledgers — cascade everything inside
  const { data: ownedRows, error: ownedErr } = await sb
    .from("ledgers")
    .select("id")
    .eq("owner_id", userId);
  if (ownedErr) throw ownedErr;

  const ownedIds = (ownedRows ?? []).map((l) => l.id);
  if (ownedIds.length > 0) {
    const { error: delErr } = await sb
      .from("ledgers")
      .delete()
      .in("id", ownedIds);
    if (delErr) throw delErr;
  }

  // 2) Push subscriptions — they're per-device tokens, no point keeping them
  // if we're nuking the user's data.
  const { count: pushCount } = await sb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { error: pushErr } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (pushErr) throw pushErr;

  // 3) Count shared-ledger memberships left over so the UI can mention them.
  const { count: sharedCount } = await sb
    .from("ledger_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return {
    ledgersDeleted: ownedIds.length,
    pushSubscriptionsDeleted: pushCount ?? 0,
    sharedLedgersKept: sharedCount ?? 0,
  };
}
