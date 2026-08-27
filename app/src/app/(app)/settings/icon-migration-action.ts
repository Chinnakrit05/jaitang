"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { listCategories, updateCategory } from "@/lib/categories";
import { listAccounts, updateAccount } from "@/lib/accounts";
import { listTrips, updateTrip } from "@/lib/trips";
import { listGoals, updateGoal } from "@/lib/goals";
import { listLedgersForUser, updateLedger } from "@/lib/ledgers";
import {
  ICON_MIGRATION_KINDS,
  changeKey,
  planIconMigration,
  type IconMigrationChange,
  type IconOwner,
} from "@/lib/icon-migration";

/**
 * Everything the signed-in user can convert, in one list.
 *
 * Scope is the ledger they are in for the four per-ledger tables, plus the
 * icon on any ledger they own. Archived accounts, trips and goals are
 * included — they still show up in lists, so a stale emoji on one is just
 * as visible.
 */
async function collectIconOwners(
  userId: string,
  ledgerId: string
): Promise<IconOwner[]> {
  const [categories, accounts, trips, goals, ledgers] = await Promise.all([
    listCategories(ledgerId),
    listAccounts(ledgerId, { includeArchived: true }),
    listTrips(ledgerId, { includeArchived: true }),
    listGoals(ledgerId, { includeArchived: true }),
    listLedgersForUser(userId),
  ]);

  return [
    ...categories.map((c) => ({
      kind: "category" as const,
      id: c.id,
      name: c.name,
      icon: c.icon,
    })),
    ...accounts.map((a) => ({
      kind: "account" as const,
      id: a.id,
      name: a.name,
      icon: a.icon,
    })),
    ...trips.map((t) => ({
      kind: "trip" as const,
      id: t.id,
      name: t.name,
      icon: t.icon,
    })),
    ...goals.map((g) => ({
      kind: "goal" as const,
      id: g.id,
      name: g.name,
      icon: g.icon,
    })),
    // Only ledgers they own: a shared ledger's icon is the owner's to
    // change, not every member's.
    ...ledgers
      .filter((l) => l.owner_id === userId)
      .map((l) => ({
        kind: "ledger" as const,
        id: l.id,
        name: l.name,
        icon: l.icon,
      })),
  ];
}

export async function proposeIconMigrationAction(): Promise<
  { ok: true; changes: IconMigrationChange[]; scanned: number } | { ok: false; error: string }
> {
  // Outside the try: requireSession throws Next's redirect when there is
  // no session, and catching it would render "NEXT_REDIRECT" as an error.
  const { userId, ledgerId } = await requireSession();
  try {
    const rows = await collectIconOwners(userId, ledgerId);
    return {
      ok: true as const,
      changes: planIconMigration(rows),
      scanned: rows.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "อ่านรายการไอคอนไม่สำเร็จ";
    return { ok: false as const, error: message };
  }
}

const SelectionSchema = z.object({
  selected: z
    .array(
      z.object({
        kind: z.enum(ICON_MIGRATION_KINDS),
        id: z.string().uuid(),
      })
    )
    .min(1)
    .max(1000),
});

/**
 * Convert the rows the user kept ticked.
 *
 * The client sends which rows to convert, never what to write. The plan is
 * rebuilt here from the database and the selection is used only to filter
 * it, so a tampered payload can at most convert fewer rows than were
 * offered — it can't put an arbitrary value in an arbitrary row, or reach
 * a ledger that isn't the caller's.
 *
 * Written one at a time rather than in parallel so a failure halfway
 * through reports the count that actually landed.
 */
export async function applyIconMigrationAction(
  selected: Array<{ kind: string; id: string }>
): Promise<
  { ok: true; applied: number } | { ok: false; error: string; applied: number }
> {
  const { userId, ledgerId } = await requireSession();
  const parsed = SelectionSchema.safeParse({ selected });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      applied: 0,
    };
  }

  let applied = 0;
  try {
    const rows = await collectIconOwners(userId, ledgerId);
    const wanted = new Set(
      parsed.data.selected.map((s) => changeKey(s.kind, s.id))
    );
    const changes = planIconMigration(rows).filter((c) =>
      wanted.has(changeKey(c.kind, c.id))
    );

    for (const change of changes) {
      switch (change.kind) {
        case "category":
          await updateCategory(change.id, { icon: change.to });
          break;
        case "account":
          await updateAccount(change.id, ledgerId, { icon: change.to });
          break;
        case "trip":
          await updateTrip(change.id, ledgerId, { icon: change.to });
          break;
        case "goal":
          await updateGoal(change.id, ledgerId, { icon: change.to });
          break;
        case "ledger":
          await updateLedger(change.id, { icon: change.to });
          break;
      }
      applied++;
    }
  } catch (err) {
    refreshIconSurfaces();
    const message = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    return { ok: false as const, error: message, applied };
  }

  refreshIconSurfaces();
  return { ok: true as const, applied };
}

/** Icons show up on nearly every screen, so this sweeps the lot. */
function refreshIconSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidatePath("/accounts");
  revalidatePath("/balances");
  revalidatePath("/trips");
  revalidatePath("/goals");
  revalidatePath("/reports");
  revalidatePath("/insights");
  revalidatePath("/settings");
}
