import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { createClient } from '@/libs/supabase/server';
import {
  consumePhoneVerificationToken,
  restorePhoneVerificationToken,
} from '@/libs/supabase/queries/phone-verification';
import { applySignupBenefits } from '@/libs/supabase/queries/signup-benefits';
import { findProfileByPhone } from '@/libs/supabase/queries/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SignupRequestBody {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  phoneVerificationToken?: string;
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

  const { email, password, fullName, phoneVerificationToken, referralCode } =
    body;
  const phone = body.phone?.replace(/-/g, '');
  if (!email || !password || !phone || !phoneVerificationToken) {
    return NextResponse.json(
      { error: 'email, password, phone, phoneVerificationToken은 필수입니다.' },
      { status: 400 },
    );
  }

  try {
    // profiles.phone 유니크 제약 위반은 handle_new_user() 트리거 실패로 이어져 GoTrue가
    // 원인 상세 없이 빈 바디+500(AuthRetryableFetchError)을 반환한다 — signUp() 이전에
    // 미리 걸러내야 사용자에게 실제 원인을 안내할 수 있다.
    const existingPhoneProfile = await findProfileByPhone(phone);
    if (existingPhoneProfile) {
      return NextResponse.json(
        {
          error:
            '이미 가입에 사용된 휴대폰 번호입니다. 로그인 또는 비밀번호 찾기를 이용해 주세요.',
        },
        { status: 400 },
      );
    }

    // 원자적 CAS로 먼저 소비 처리한다 — 동시 요청이 같은 인증으로 계정을 중복 생성하지
    // 못하도록 auth.signUp() 이전에 소비해야 한다(TOCTOU 레이스 방지).
    const consumedTokenId = await consumePhoneVerificationToken(
      phone,
      phoneVerificationToken,
    );
    if (!consumedTokenId) {
      return NextResponse.json(
        { error: '휴대폰 인증이 필요하거나 인증이 만료되었습니다.' },
        { status: 400 },
      );
    }

    const supabase = createClient();
    // public.profiles row는 handle_new_user() 트리거가 raw_user_meta_data->>'full_name'/'phone'을
    // 읽어 자동으로 생성하므로, 여기서 별도 profiles insert를 하지 않는다.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    if (error) {
      // 이메일 중복 등 이후 단계 실패 — 방금 소비한 토큰을 되돌려 휴대폰 인증부터 다시
      // 하지 않고 재시도할 수 있게 한다. 복원 자체가 실패해도 원래 에러 메시지는 그대로
      // 사용자에게 보여준다(복원 실패는 로그로만 남김).
      try {
        await restorePhoneVerificationToken(consumedTokenId);
      } catch (restoreError) {
        console.error('[auth/signup] 토큰 복원 실패:', restoreError);
      }
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
    // 구분할 수 없음을 확인함). 이 프로젝트는 이미 가입 전 휴대폰 SMS 인증으로 실사용자를
    // 확인하므로 이메일 확인(Supabase 대시보드 Authentication → Providers → Email →
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
