import { requireSession } from "@/lib/session";
import { collectBackup } from "@/lib/backup";

export async function GET() {
  const { userId } = await requireSession();
  const backup = await collectBackup(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `jaitang-backup-${stamp}.json`;
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
