// Minimal service worker for Web Push. Registered by lib/push-client.ts once
// a user is logged in. This does not do any caching / offline support — its
// only job is to show a notification when a push arrives and to focus/open
// the app when the user taps it.

self.addEventListener("push", (event) => {
  let data = { title: "YNG Staff", body: "You have a new notification.", url: "/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        // Reuse an already-open tab instead of opening a new one.
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
