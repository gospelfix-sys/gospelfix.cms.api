'use client';

import { useEffect } from 'react';

/** 앱이 화면에 보이면 아이콘 배지와 알림센터에 남은 알림을 비운다. */
async function clearBadge() {
  if (document.visibilityState !== 'visible') return;
  try {
    await navigator.clearAppBadge?.();
    const reg = await navigator.serviceWorker?.getRegistration('/sw.js');
    (await reg?.getNotifications())?.forEach((n) => n.close());
  } catch (error) {
    console.error('[push] 배지 초기화 실패', error);
  }
}

export default function AppBadgeClearer() {
  useEffect(() => {
    clearBadge();
    document.addEventListener('visibilitychange', clearBadge);
    return () => document.removeEventListener('visibilitychange', clearBadge);
  }, []);

  return null;
}
