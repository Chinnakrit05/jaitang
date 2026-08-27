import type { IconName } from "@/components/icons";
import { iconNameForEmoji } from "./emoji-to-icon";

export const ICON_MIGRATION_KINDS = [
  "category",
  "account",
  "trip",
  "goal",
  "ledger",
] as const;

export type IconMigrationKind = (typeof ICON_MIGRATION_KINDS)[number];

/** Anything with an `icon` column: the five tables that store one. */
export type IconOwner = {
  kind: IconMigrationKind;
  id: string;
  name: string;
  icon: string | null;
};

export type IconMigrationChange = {
  kind: IconMigrationKind;
  id: string;
  name: string;
  /** The emoji as stored today. */
  from: string;
  to: IconName;
};

/** Stable identity for a row across the propose → apply round-trip. Ids
 *  are unique per table, not across them, so the kind is part of the key. */
export function changeKey(kind: IconMigrationKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Work out which rows have an emoji that an icon can replace.
 *
 * Everything else is skipped rather than guessed at: a row already holding
 * an icon name, one with no icon at all, and — the important case — an
 * emoji with no honest match in the icon set. Those keep what they have.
 *
 * Pure so the rules can be tested without a database; the action calls it
 * twice, once to show the user and once to decide what it is allowed to
 * write.
 */
export function planIconMigration(rows: IconOwner[]): IconMigrationChange[] {
  const changes: IconMigrationChange[] = [];
  for (const row of rows) {
    if (!row.icon) continue;
    const to = iconNameForEmoji(row.icon);
    if (!to || to === row.icon) continue;
    changes.push({
      kind: row.kind,
      id: row.id,
      name: row.name,
      from: row.icon,
      to,
    });
  }
  return changes;
}
