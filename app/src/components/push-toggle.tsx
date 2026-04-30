"use client";

import { useEffect, useState, useTransition } from "react";
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
    return (
      <p className="text-sm text-(--muted)">
        ฟีเจอร์แจ้งเตือนยังไม่เปิดใช้งาน — ผู้ดูแลต้องตั้ง VAPID keys ใน env ก่อน
      </p>
    );
  }

  if (!supported) {
    return (
      <p className="text-sm text-(--muted)">
        เบราว์เซอร์นี้ไม่รองรับ Web Push (ลอง Chrome/Edge/Firefox/Safari ใหม่ ๆ)
      </p>
    );
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
          setError("คุณยังไม่อนุญาตการแจ้งเตือน");
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
        setError(e instanceof Error ? e.message : "ไม่สามารถเปิดการแจ้งเตือน");
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
        setError(e instanceof Error ? e.message : "ไม่สามารถปิดการแจ้งเตือน");
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
            ปิดการแจ้งเตือน
          </button>
        ) : (
          <button
            type="button"
            onClick={turnOn}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) hover:opacity-90 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
            เปิดการแจ้งเตือน
          </button>
        )}

        {subscribed && (
          <span className="text-xs text-(--income)">เปิดอยู่ — เบราว์เซอร์นี้</span>
        )}
        {permission === "denied" && (
          <span className="text-xs text-(--expense)">
            ถูกบล็อก — แก้ที่ตั้งค่าเบราว์เซอร์
          </span>
        )}
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <p className="text-xs text-(--muted)">
        เปิดเครื่องไหน เครื่องนั้นจะรับแจ้งเตือนแยกกัน — เช่น มือถือ + คอมจะได้คนละสาย
      </p>
    </div>
  );
}
