import { getServerSupabase } from "@/lib/supabase/server";
import { collectBackup } from "@/lib/backup";
import { nowInBusinessTz } from "@/lib/business-tz";

/**
 * The nightly backup: the same JSON as the download button on
 * /settings, one file per user per day, in a private Storage bucket.
 *
 * Same file as the manual one on purpose, so getting a day back is the
 * restore flow that already exists — download the day, restore it.
 *
 * It sits in the same Supabase project as the data, so it covers a
 * bad edit, a wipe or a migration gone wrong, not losing the project.
 */

export const BACKUP_BUCKET = "backups";
export const KEEP_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD in Bangkok — a run at 03:00 on the 25th files as the 25th. */
export function backupDateKey(now: Date): string {
  return nowInBusinessTz(now).toISOString().slice(0, 10);
}

export function backupPath(userId: string, dateKey: string): string {
  return `${userId}/${dateKey}.json`;
}

export function isBackupDateKey(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Of a user's backup file names, the ones older than the last `keepDays`
 * days counting `todayKey`. Names that aren't a date are left alone —
 * this only ever deletes what it wrote.
 */
export function namesToPrune(names: string[], todayKey: string, keepDays: number): string[] {
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const cutoff = today - (keepDays - 1) * 86_400_000;
  return names.filter((name) => {
    const key = name.replace(/\.json$/, "");
    if (!name.endsWith(".json") || !isBackupDateKey(key)) return false;
    return Date.parse(`${key}T00:00:00Z`) < cutoff;
  });
}

export type AutoBackupResult = {
  date: string;
  written: number;
  skippedEmpty: number;
  pruned: number;
  failed: { userId: string; error: string }[];
};

/** Back up every user, then drop each user's files past KEEP_DAYS. */
export async function runAutoBackup(now: Date = new Date()): Promise<AutoBackupResult> {
  const sb = getServerSupabase();
  const date = backupDateKey(now);
  const result: AutoBackupResult = { date, written: 0, skippedEmpty: 0, pruned: 0, failed: [] };

  const { data: users, error } = await sb.from("users").select("id");
  if (error) throw error;

  for (const { id } of users ?? []) {
    const userId = id as string;
    try {
      const backup = await collectBackup(userId);
      // Someone who signed in once and never kept a book: nothing to keep.
      if (backup.ledgers.length === 0) {
        result.skippedEmpty += 1;
        continue;
      }
      const { error: upErr } = await sb.storage
        .from(BACKUP_BUCKET)
        .upload(backupPath(userId, date), JSON.stringify(backup), {
          contentType: "application/json",
          upsert: true,
        });
      if (upErr) throw upErr;
      result.written += 1;

      const { data: files, error: listErr } = await sb.storage
        .from(BACKUP_BUCKET)
        .list(userId, { limit: 1000 });
      if (listErr) throw listErr;
      const stale = namesToPrune(
        (files ?? []).map((f) => f.name),
        date,
        KEEP_DAYS,
      );
      if (stale.length > 0) {
        const { error: rmErr } = await sb.storage
          .from(BACKUP_BUCKET)
          .remove(stale.map((name) => `${userId}/${name}`));
        if (rmErr) throw rmErr;
        result.pruned += stale.length;
      }
    } catch (e) {
      result.failed.push({
        userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}

/** The dates a user has a backup for, newest first. [] if none or unreadable. */
export async function listAutoBackups(userId: string): Promise<string[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb.storage.from(BACKUP_BUCKET).list(userId, { limit: 1000 });
  if (error) {
    console.warn("[auto-backup] list failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((f) => f.name.replace(/\.json$/, ""))
    .filter(isBackupDateKey)
    .sort()
    .reverse();
}

/** One day's file for a user, or null when there isn't one. */
export async function readAutoBackup(userId: string, dateKey: string): Promise<Blob | null> {
  if (!isBackupDateKey(dateKey)) return null;
  const sb = getServerSupabase();
  const { data, error } = await sb.storage.from(BACKUP_BUCKET).download(backupPath(userId, dateKey));
  if (error || !data) return null;
  return data;
}
