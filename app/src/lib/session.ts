import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensurePersonalLedger } from "@/lib/ledgers";

/**
 * Convenience: protect a server route, return userId + active ledgerId.
 * For MVP, "active ledger" = the user's personal ledger. Phase 2 will
 * accept a `?ledger=<id>` param and verify membership.
 */
export async function requireSession() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const ledgerId = await ensurePersonalLedger(userId);
  return {
    userId,
    ledgerId,
    user: session!.user!,
  };
}
