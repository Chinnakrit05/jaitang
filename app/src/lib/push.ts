import webpush from "web-push";
import { getServerSupabase } from "@/lib/supabase/server";

let configured = false;

function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@jaitang.local";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export async function saveSubscription(opts: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const sb = getServerSupabase();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: opts.userId,
      endpoint: opts.endpoint,
      p256dh: opts.p256dh,
      auth: opts.auth,
      user_agent: opts.userAgent ?? null,
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) throw error;
}

export async function deleteSubscription(opts: { userId: string; endpoint: string }) {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", opts.userId)
    .eq("endpoint", opts.endpoint);
  if (error) throw error;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;       // path to open on notification click
  tag?: string;       // dedupe key (later push with same tag replaces previous)
  icon?: string;
};

/**
 * Best-effort: send a push to every subscription for the given user ids.
 * Silently no-ops if VAPID is not configured. Cleans up dead 410/404 endpoints.
 */
export async function sendToUsers(userIds: string[], payload: PushPayload) {
  if (!configure()) return { sent: 0, dropped: 0 };
  if (userIds.length === 0) return { sent: 0, dropped: 0 };

  const sb = getServerSupabase();
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);
  if (error) throw error;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag ?? "jaitang",
    icon: payload.icon ?? "/icon-192.png",
  });

  let sent = 0;
  const deadIds: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          deadIds.push(s.id);
        } else {
          console.error("[push] send failed:", err);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await sb.from("push_subscriptions").delete().in("id", deadIds);
  }

  return { sent, dropped: deadIds.length };
}
