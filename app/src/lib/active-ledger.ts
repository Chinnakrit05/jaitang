import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";
import { ensurePersonalLedger } from "@/lib/ledgers";

const COOKIE = "jt_active_ledger";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Resolve the user's active ledger:
 * 1. Read cookie; if present and the user is a member/owner, return it.
 * 2. Otherwise fall back to the user's personal ledger.
 *
 * Always validates membership — never trusts the cookie blindly.
 * Cached per request — multiple components calling it pay only one trip.
 */
export const resolveActiveLedger = cache(async (userId: string): Promise<string> => {
  const store = await cookies();
  const cookieValue = store.get(COOKIE)?.value;

  if (cookieValue) {
    const sb = getServerSupabase();
    const { data: owned } = await sb
      .from("ledgers")
      .select("id")
      .eq("id", cookieValue)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (owned) return owned.id as string;

    // The membership row itself is fine, but if the underlying ledger was
    // soft-deleted we shouldn't honor the cookie. Filter via the join.
    const { data: member } = await sb
      .from("ledger_members")
      .select("ledger_id, ledgers!inner(id)")
      .eq("ledger_id", cookieValue)
      .eq("user_id", userId)
      .is("ledgers.deleted_at", null)
      .maybeSingle();
    if (member) return member.ledger_id as string;
  }

  return ensurePersonalLedger(userId);
});

export async function setActiveLedgerCookie(ledgerId: string) {
  const store = await cookies();
  store.set(COOKIE, ledgerId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
