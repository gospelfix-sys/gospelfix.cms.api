import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { createAdminClient } from '@/libs/supabase/admin';
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  type GoogleProfile,
} from '@/libs/supabase/queries/google';
import { issueSessionForEmail } from '@/libs/supabase/queries/oauth-session';
import { applySignupBenefits } from '@/libs/supabase/queries/signup-benefits';
import { findProfileByEmail } from '@/libs/supabase/queries/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GoogleLoginRequestBody {
  code?: string;
  redirectUri?: string;
  referralCode?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('google');
  if (disabledError) return disabledError;

  let body: GoogleLoginRequestBody;
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

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('[auth/google] GOOGLE_CLIENT_ID/SECRET이 설정되지 않았습니다.');
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }

  // 구글 인가 code도 1회용·단기 만료라 토큰 교환/프로필 조회 실패는 서버 장애가 아니라
  // 흔한 정상 실패 경로다 — main이 "다시 로그인 필요"와 "서버 장애"를 구분할 수 있게
  // 개별적으로 잡아 400으로 변환한다(kakao 라우트와 동일한 정책).
  let googleAccessToken: string;
  try {
    googleAccessToken = await exchangeGoogleCode(code, redirectUri);
  } catch (err) {
    console.error('[auth/google] 구글 토큰 교환 실패:', err);
    return NextResponse.json(
      { error: '구글 인증에 실패했습니다. 다시 로그인해 주세요.' },
      { status: 400 },
    );
  }

  let googleProfile: GoogleProfile;
  try {
    googleProfile = await fetchGoogleProfile(googleAccessToken);
  } catch (err) {
    console.error('[auth/google] 구글 프로필 조회 실패:', err);
    return NextResponse.json(
      { error: '구글 프로필 조회에 실패했습니다. 다시 로그인해 주세요.' },
      { status: 400 },
    );
  }

  // 계정 연결이 이메일 기준이라, 구글이 소유 확인한 이메일만 받는다. 미확인 이메일을
  // 허용하면 타인의 이메일로 만든 구글 계정으로 기존 회원 계정에 로그인할 수 있다.
  if (!googleProfile.email || !googleProfile.emailVerified) {
    return NextResponse.json(
      { error: '이메일이 인증된 구글 계정만 사용할 수 있습니다.' },
      { status: 400 },
    );
  }

  try {
    // 신규가입 vs 재로그인 판별은 profiles row 존재 여부로 한다(kakao와 동일) —
    // createUser() 호출 전에 조회해야 신규 유저에게만 가입 혜택을 한 번 부여한다.
    const existingProfile = await findProfileByEmail(googleProfile.email);
    const isNewUser = !existingProfile;

    if (isNewUser) {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email: googleProfile.email,
        email_confirm: true,
        user_metadata: {
          full_name: googleProfile.name,
          avatar_url: googleProfile.avatarUrl,
          provider: 'google',
        },
      });

      if (error || !data.user) {
        console.error('[auth/google] createUser error:', error);
        return NextResponse.json(
          { error: '구글 계정으로 가입 처리 중 오류가 발생했습니다.' },
          { status: 400 },
        );
      }

      await applySignupBenefits(data.user.id, referralCode);
    }

    const { session, user } = await issueSessionForEmail(googleProfile.email);

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
    console.error('[auth/google] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
