// Service worker de SkyHigh Rutas: solo maneja notificaciones push.
// No cachea nada (no es una estrategia offline-first), para no complicar
// el despliegue normal de Next.js.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SkyHigh Rutas", body: event.data.text() };
  }

  const options = {
    body: payload.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: payload.url || "/ordenes" },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "SkyHigh Rutas", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/ordenes";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((c) => new URL(c.url).pathname === url);
      if (existing) {
        await existing.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});
