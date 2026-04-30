"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/(app)/settings/actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [supported, setSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sup = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(sup);
    if (!sup) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) {
        setSubscribed(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  if (!vapidPublicKey) {
    return <p className="text-sm text-(--muted)">{t("push.notConfigured")}</p>;
  }

  if (!supported) {
    return <p className="text-sm text-(--muted)">{t("push.browserUnsupported")}</p>;
  }

  async function turnOn() {
    setError(null);
    startTransition(async () => {
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setError(t("push.noPermission"));
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
        });
        const json = sub.toJSON();
        await subscribePushAction({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
        setSubscribed(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("push.turnOn"));
      }
    });
  }

  async function turnOff() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribePushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("push.turnOff"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {subscribed ? (
          <button
            type="button"
            onClick={turnOff}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
            {t("push.turnOff")}
          </button>
        ) : (
          <button
            type="button"
            onClick={turnOn}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) hover:opacity-90 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
            {t("push.turnOn")}
          </button>
        )}

        {subscribed && <span className="text-xs text-(--income)">{t("push.active")}</span>}
        {permission === "denied" && (
          <span className="text-xs text-(--expense)">{t("push.blocked")}</span>
        )}
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <p className="text-xs text-(--muted)">{t("push.perDeviceHint")}</p>
    </div>
  );
}
