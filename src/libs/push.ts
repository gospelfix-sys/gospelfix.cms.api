import { sendNotification, setVapidDetails } from 'web-push';
import {
  deletePushSubscription,
  getAdminPushSubscriptions,
} from '@/libs/supabase/queries/push-subscriptions.admin';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// 공개 API 응답이 푸시 서비스 지연에 묶이지 않도록 제한한다.
const SEND_OPTIONS = { timeout: 5000, TTL: 3600 };

/**
 * 모든 관리자 구독 기기로 웹 푸시를 보낸다.
 * 만료된 구독(404/410)은 삭제한다. VAPID 키가 없으면 조용히 건너뛰지 않고 에러를 던진다.
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID 환경변수가 설정되지 않았습니다.');
  }
  setVapidDetails(subject, publicKey, privateKey);

  const subscriptions = await getAdminPushSubscriptions();
  const message = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async ({ endpoint, p256dh, auth }) => {
      // endpoint는 사실상 비밀 URL이라 로그에는 호스트만 남긴다.
      let host = 'invalid-endpoint';
      try {
        host = new URL(endpoint).host;
        await sendNotification(
          { endpoint, keys: { p256dh, auth } },
          message,
          SEND_OPTIONS,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await deletePushSubscription(endpoint);
          } catch (deleteError) {
            console.error('[push] 만료 구독 삭제 실패', host, deleteError);
          }
          return;
        }
        // WebPushError는 endpoint를 own property로 가져 객체째 출력하면 노출되므로 message만 남긴다.
        console.error('[push] 발송 실패', host, statusCode, (error as Error).message);
      }
    }),
  );
}
