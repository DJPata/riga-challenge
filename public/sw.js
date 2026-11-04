// Service Worker: Benachrichtigungen, Push-Nachrichten und "Zum Home-Bildschirm"
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) =>
      list.length ? list[0].focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || "./")
    )
  );
});

// Push-Nachrichten vom Server (Pflicht-Alarm). Kommen auch, wenn die App geschlossen ist.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { data: { body: e.data && e.data.text() } }; }
  const n = Object.assign({}, d.notification || {}, d.data || {});
  const title = n.title || "Riga-Challenge";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: n.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: n.tag || "riga",
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 800],
      data: { url: n.url || "./" },
    })
  );
});
