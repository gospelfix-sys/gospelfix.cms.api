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
    self.registration
      .showNotification(data.title || 'GospelFix', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/quotes' },
      })
      // 앱 아이콘 배지 = 아직 확인하지 않은(알림센터에 남은) 알림 수. 앱을 열면 클라이언트가 비운다.
      .then(async () => {
        // 앱을 보고 있는 중이면 이미 확인한 것이므로 배지를 올리지 않는다.
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clients.some((c) => c.visibilityState === 'visible')) return;
        const list = await self.registration.getNotifications();
        return navigator.setAppBadge?.(list.length);
      })
      .catch((error) => console.error('[push] 배지 갱신 실패', error)),
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
