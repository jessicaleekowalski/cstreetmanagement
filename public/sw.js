// C-Street push notifications service worker.
// Handles incoming web-push payloads and click navigation.
// This worker does NOT cache the app shell — it is push-only.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "C-Street", body: "You have a new notification", url: "/dashboard" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (_) {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }
  const options = {
    body: payload.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: payload.tag,
    data: { url: payload.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsArr) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(target); } catch (_) {}
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
