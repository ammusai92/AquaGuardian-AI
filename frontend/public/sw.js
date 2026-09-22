// AquaGuardian push service worker — shows notifications even when the app is closed
self.addEventListener('push', (event) => {
  let data = { title: 'AquaGuardian Alert', body: 'Open the dashboard for details.' };
  try { if (event.data) data = event.data.json(); } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: 'aquaguardian-alert', // replaces old alert instead of stacking
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('/');
  }));
});