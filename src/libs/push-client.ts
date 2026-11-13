import { subscribePushAction } from '@/app/(admin)/settings/actions';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// 사용자가 직접 끈 기기는 권한이 granted여도 자동 구독하지 않는다.
const OPTED_OUT_KEY = 'push-opted-out';

export function isPushOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPushOptedOut(value: boolean) {
  try {
    if (value) localStorage.setItem(OPTED_OUT_KEY, '1');
    else localStorage.removeItem(OPTED_OUT_KEY);
  } catch {
    // 저장소 접근이 막힌 환경에서는 자동 구독 제외 표시만 포기한다.
  }
}

export async function subscribeAndSave(reg: ServiceWorkerRegistration) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY가 설정되지 않았습니다.');
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
  const keys = sub.toJSON().keys;
  try {
    if (!keys?.p256dh || !keys.auth) {
      throw new Error('구독 키를 가져오지 못했습니다.');
    }
    await subscribePushAction(
      { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth },
      navigator.userAgent,
    );
  } catch (error) {
    // 서버 저장에 실패하면 브라우저에만 남는 고아 구독을 정리한다.
    await sub.unsubscribe();
    throw error;
  }
}
