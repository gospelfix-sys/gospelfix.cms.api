import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { createClient } from '@/libs/supabase/server';
import { applySignupBenefits } from '@/libs/supabase/queries/signup-benefits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SignupRequestBody {
  email?: string;
  password?: string;
  fullName?: string;
  referralCode?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('signup');
  if (disabledError) return disabledError;

  let body: SignupRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, password, fullName, referralCode } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: 'email, password는 필수입니다.' },
      { status: 400 },
    );
  }

  try {
    const supabase = createClient();
    // public.profiles row는 handle_new_user() 트리거가 raw_user_meta_data->>'full_name'을
    // 읽어 자동으로 생성하므로, 여기서 별도 profiles insert를 하지 않는다.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      // Supabase auth-js는 인증 서버 응답이 예상 형식(error_description/msg)이 아니면
      // 응답 바디를 그대로 JSON.stringify해 message로 채우는 폴백이 있어, 드물게
      // error.message가 "{}" 같은 의미 없는 문자열이 될 수 있다(예: 내장 이메일 발송
      // 한도 초과 등 인증 서버 쪽 이상 응답). 그런 경우 사용자에게는 읽을 수 있는
      // 안내를 보여주고, 실제 원인 파악은 서버 로그로 한다.
      console.error('[auth/signup] supabase.auth.signUp error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      });
      const isUsefulMessage =
        Boolean(error.message?.trim()) && error.message !== '{}';
      return NextResponse.json(
        {
          error: isUsefulMessage
            ? error.message
            : '회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        },
        { status: 400 },
      );
    }

    // 회원가입 혜택(가입 쿠폰/추천인 코드/추천인 적용)은 confirmation_required 분기보다
    // 먼저 처리한다. data.user는 세션 유무와 관계없이 항상 채워진다 — 예전에는 이 블록이
    // 아래 confirmation_required 분기 뒤에 있어서, 이메일 확인이 켜진 프로젝트에서는
    // confirmation_required로 먼저 return돼버려 쿠폰/추천인 로직에 영원히 도달하지 못했다.
    //
    // 이메일 확인이 켜진 상태에서는 미확인 계정으로 폼을 재제출할 때마다 이 블록이 다시
    // 실행돼 쿠폰/추천인 보상이 중복 발급되는 위험이 있다(Supabase가 재제출에도 동일하게
    // 비어있지 않은 data.user.identities를 반환해, identities 기반으로는 신규/재제출을
    // 구분할 수 없음을 확인함). 그래서 이메일 확인(Supabase 대시보드 Authentication → Providers → Email →
    // Confirm email)을 끄기로 결정했다 — 꺼져 있으면 signUp() 즉시 session이 발급되어
    // 아래 confirmation_required 분기 자체를 타지 않으므로 이 재시도 중복발급 시나리오가
    // 발생하지 않는다. 이 설정이 실제로 꺼져 있는지 배포 전 반드시 확인할 것.
    if (data.user) {
      await applySignupBenefits(data.user.id, referralCode);
    }

    // 이메일 확인이 켜져 있으면 session이 null이고, 꺼져 있으면 즉시 세션이 발급된다.
    if (!data.session) {
      return NextResponse.json({
        status: 'confirmation_required',
        user: data.user,
      });
    }

    return NextResponse.json({
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[auth/signup] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
