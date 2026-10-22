import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { createAdminClient } from '@/libs/supabase/admin';
import {
  exchangeKakaoCode,
  fetchKakaoProfile,
  type KakaoProfile,
} from '@/libs/supabase/queries/kakao';
import { issueSessionForEmail } from '@/libs/supabase/queries/oauth-session';
import { applySignupBenefits } from '@/libs/supabase/queries/signup-benefits';
import { findProfileByEmail } from '@/libs/supabase/queries/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KakaoLoginRequestBody {
  code?: string;
  redirectUri?: string;
  referralCode?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('kakao');
  if (disabledError) return disabledError;

  let body: KakaoLoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, redirectUri, referralCode } = body;
  if (!code || !redirectUri) {
    return NextResponse.json(
      { error: 'code와 redirectUri는 필수입니다.' },
      { status: 400 },
    );
  }

  if (!process.env.KAKAO_CLIENT_ID || !process.env.KAKAO_CLIENT_SECRET) {
    console.error('[auth/kakao] KAKAO_CLIENT_ID/SECRET이 설정되지 않았습니다.');
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }

  // 카카오 인가 code는 1회용·단기 만료라 토큰 교환/프로필 조회 실패는 서버 장애가
  // 아니라 흔히 발생하는 정상적인 실패 경로다(중복 클릭, 만료, 재시도 등) — 최하단
  // catch로 뭉뚱그려 500을 반환하면 main이 "다시 로그인 필요"와 "서버 장애"를
  // 구분할 수 없으므로 개별적으로 잡아 400으로 변환한다.
  let kakaoAccessToken: string;
  try {
    kakaoAccessToken = await exchangeKakaoCode(code, redirectUri);
  } catch (err) {
    console.error('[auth/kakao] 카카오 토큰 교환 실패:', err);
    return NextResponse.json(
      { error: '카카오 인증에 실패했습니다. 다시 로그인해 주세요.' },
      { status: 400 },
    );
  }

  let kakaoProfile: KakaoProfile;
  try {
    kakaoProfile = await fetchKakaoProfile(kakaoAccessToken);
  } catch (err) {
    console.error('[auth/kakao] 카카오 프로필 조회 실패:', err);
    return NextResponse.json(
      { error: '카카오 프로필 조회에 실패했습니다. 다시 로그인해 주세요.' },
      { status: 400 },
    );
  }

  if (!kakaoProfile.email) {
    return NextResponse.json(
      { error: '카카오 계정의 이메일 제공 동의가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    // 신규가입 vs 재로그인 판별은 identities 필드가 아니라 profiles row 존재 여부로
    // 한다(project_oauth_signup_benefits_requirement 메모리 참고) — createUser() 호출
    // 전에 먼저 조회해야 신규 유저에게만 가입 혜택을 정확히 한 번 부여할 수 있다.
    const existingProfile = await findProfileByEmail(kakaoProfile.email);
    const isNewUser = !existingProfile;

    if (isNewUser) {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email: kakaoProfile.email,
        email_confirm: true,
        user_metadata: {
          full_name: kakaoProfile.nickname,
          avatar_url: kakaoProfile.avatarUrl,
          provider: 'kakao',
        },
      });

      if (error || !data.user) {
        console.error('[auth/kakao] createUser error:', error);
        return NextResponse.json(
          { error: '카카오 계정으로 가입 처리 중 오류가 발생했습니다.' },
          { status: 400 },
        );
      }

      await applySignupBenefits(data.user.id, referralCode);
    }

    const { session, user } = await issueSessionForEmail(kakaoProfile.email);

    return NextResponse.json({
      user,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
      },
      isNewUser,
    });
  } catch (err) {
    console.error('[auth/kakao] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
