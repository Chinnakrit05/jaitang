// Jaitang service worker — handles push notifications + PWA install shell
const CACHE = "jaitang-shell-v1";
const SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = { title: "Jaitang", body: "มีการแจ้งเตือนใหม่", url: "/dashboard" };
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) };
  } catch (_) {}

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "jaitang",
    data: { url: data.url || "/dashboard" },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if ("focus" in w) {
            w.navigate(url).catch(() => null);
            return w.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
