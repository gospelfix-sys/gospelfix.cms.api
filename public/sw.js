self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = (event.data && event.data.json()) || {};
  } catch {
    // 페이로드가 JSON이 아니어도 기본 알림은 표시한다.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'GospelFix', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/quotes' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // 외부 URL로 열리지 않도록 same-origin만 허용한다.
  const target = new URL(event.notification.data.url, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/quotes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      if (!open) return self.clients.openWindow(url);
      return open
        .navigate(url)
        .then((c) => c && c.focus())
        .catch(() => self.clients.openWindow(url));
    }),
  );
});
