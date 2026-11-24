import { requireSession } from "@/lib/session";
import { isBackupDateKey, readAutoBackup } from "@/lib/auto-backup";

/**
 * Download one day of the nightly backup — the signed-in user's own
 * file only: the path is built from the session's user id, never from
 * the request, so there is no way to name someone else's folder.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!isBackupDateKey(date)) {
    return new Response("Not found", { status: 404 });
  }
  const { userId } = await requireSession();
  const file = await readAutoBackup(userId, date);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jaitang-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
