import { timingSafeEqual } from "node:crypto";
import { runAutoBackup } from "@/lib/auto-backup";

/**
 * Nightly backup, called by Vercel Cron (vercel.json: 20:00 UTC, which
 * is 03:00 in Bangkok).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set on the project. Without it the route refuses everyone, so a
 * missing secret shows up as a failed cron rather than as a public
 * endpoint that dumps every user's books into storage on demand.
 */
export const maxDuration = 60;

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!authorized(req.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await runAutoBackup();
  if (result.failed.length > 0) {
    console.error("[cron/backup] some users failed:", result.failed);
  }
  return Response.json(
    { ok: result.failed.length === 0, ...result },
    { status: result.failed.length === 0 ? 200 : 500 },
  );
}
