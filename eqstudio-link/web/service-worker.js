// eqstudio.link Service Worker — handles Web Push events and PWA install.
// Kept intentionally minimal: no offline caching (not needed for this app),
// just push notification delivery + click handling.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "eqstudio.link", body: "Anda ada kemas kini baharu.", url: "/dashboard.html" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* keep default payload if parsing fails */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/assets/logo/logo-128.png",
      badge: "/assets/logo/logo-64.png",
      data: { url: payload.url },
      tag: payload.tag || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(new URL(targetUrl, self.location.origin).pathname) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
