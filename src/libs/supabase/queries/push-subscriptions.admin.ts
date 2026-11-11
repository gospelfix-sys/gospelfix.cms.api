import { createAdminClient } from '@/libs/supabase/admin';

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface UpsertPushSubscriptionInput extends PushSubscriptionRow {
  userId: string;
  userAgent: string | null;
}

export async function upsertPushSubscription(
  input: UpsertPushSubscriptionInput,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

/** userId를 주면 해당 사용자의 구독만 삭제한다. 만료 정리(발송 측)는 생략한다. */
export async function deletePushSubscription(
  endpoint: string,
  userId?: string,
): Promise<void> {
  const supabase = createAdminClient();
  let query = supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/** 관리자(profiles.role='admin') 소유 구독만 반환한다. */
export async function getAdminPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, profiles!inner(role)')
    .eq('profiles.role', 'admin');
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ endpoint, p256dh, auth }) => ({
    endpoint,
    p256dh,
    auth,
  }));
}
