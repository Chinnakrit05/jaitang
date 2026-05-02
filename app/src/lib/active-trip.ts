import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";

const COOKIE = "jt_active_trip";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Resolve the user's active trip relative to the active ledger:
 * - read cookie
 * - confirm the trip exists, belongs to that ledger, and isn't archived
 * - otherwise return null (and let the caller render "no active trip")
 *
 * Cached per request via React's `cache()` so repeated calls inside one
 * page render don't re-hit Supabase.
 */
export const resolveActiveTrip = cache(
  async (ledgerId: string): Promise<string | null> => {
    const store = await cookies();
    const cookieValue = store.get(COOKIE)?.value;
    if (!cookieValue) return null;

    const sb = getServerSupabase();
    const { data } = await sb
      .from("trips")
      .select("id, archived")
      .eq("id", cookieValue)
      .eq("ledger_id", ledgerId)
      .maybeSingle();

    if (!data) return null;
    if (data.archived) return null;
    return data.id as string;
  }
);

export async function setActiveTripCookie(tripId: string) {
  const store = await cookies();
  store.set(COOKIE, tripId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearActiveTripCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
