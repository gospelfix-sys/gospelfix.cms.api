import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { verifyEmailCode } from '@/libs/supabase/queries/email-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface VerifyCodeRequestBody {
  email?: string;
  code?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('email_verify_code');
  if (disabledError) return disabledError;

  let body: VerifyCodeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, code } = body;
  if (
    typeof email !== 'string' ||
    typeof code !== 'string' ||
    !email ||
    !/^\d{6}$/.test(code)
  ) {
    return NextResponse.json(
      { error: 'email과 6자리 숫자 code는 필수입니다.' },
      { status: 400 },
    );
  }

  try {
    const { verified, token } = await verifyEmailCode(email, code);
    if (!verified) {
      return NextResponse.json(
        { error: '인증번호가 올바르지 않거나 만료되었습니다.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, emailVerificationToken: token });
  } catch (err) {
    console.error('[auth/email/verify-code] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
