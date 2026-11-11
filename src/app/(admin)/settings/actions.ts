'use server';

import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { toggleApiConfig } from '@/libs/supabase/queries/content-api-configs';
import { toggleAuthApiConfig } from '@/libs/supabase/queries/auth-api-configs';
import {
  deletePushSubscription,
  upsertPushSubscription,
  type PushSubscriptionRow,
} from '@/libs/supabase/queries/push-subscriptions.admin';

export async function toggleApiConfigAction(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  await requireAdminPage();

  await toggleApiConfig(id, isEnabled);
}

// 서버가 endpoint로 직접 POST하므로(SSRF 방지) 알려진 푸시 서비스 호스트만 저장한다.
const PUSH_HOST_PATTERNS = [
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

function assertValidSubscription({ endpoint, p256dh, auth }: PushSubscriptionRow) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('유효하지 않은 푸시 구독입니다.');
  }
  const allowedHost = PUSH_HOST_PATTERNS.some((p) => p.test(url.hostname));
  if (url.protocol !== 'https:' || !allowedHost || !p256dh || !auth) {
    throw new Error('유효하지 않은 푸시 구독입니다.');
  }
}

export async function subscribePushAction(
  subscription: PushSubscriptionRow,
  userAgent: string | null,
): Promise<void> {
  const user = await requireAdminPage();

  assertValidSubscription(subscription);
  await upsertPushSubscription({ ...subscription, userId: user.id, userAgent });
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const user = await requireAdminPage();

  await deletePushSubscription(endpoint, user.id);
}

export async function toggleAuthApiConfigAction(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  await requireAdminPage();

  await toggleAuthApiConfig(id, isEnabled);
}
