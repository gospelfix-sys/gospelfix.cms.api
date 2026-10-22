import type { Session, User } from '@supabase/supabase-js';
import { createAdminClient } from '@/libs/supabase/admin';
import { createClient } from '@/libs/supabase/server';

export interface IssuedSessionResult {
  session: Session;
  user: User;
}

/**
 * 비밀번호 없이(OAuth 등) 이미 신원이 확인된 이메일에 대해 Supabase 세션을 서버 사이드에서
 * 발급한다. generateLink()는 실제로 이메일을 발송하지 않으므로 Supabase 내장 이메일 발송
 * 한도(시간당 2통)와 무관하게 동작한다. verifyOtp()가 세션과 함께 반환하는 user를 그대로
 * 써서 login/signup 응답과 동일한 User 객체 shape을 유지한다.
 */
export async function issueSessionForEmail(
  email: string,
): Promise<IssuedSessionResult> {
  const admin = createAdminClient();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
  if (linkError || !linkData) {
    throw new Error(
      linkError?.message ?? '세션 발급을 위한 링크 생성에 실패했습니다.',
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? '세션 검증에 실패했습니다.');
  }

  return { session: data.session, user: data.user };
}
