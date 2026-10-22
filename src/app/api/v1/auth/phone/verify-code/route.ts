import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { verifyPhoneCode } from '@/libs/supabase/queries/phone-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface VerifyCodeRequestBody {
  phone?: string;
  code?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('phone_verify_code');
  if (disabledError) return disabledError;

  let body: VerifyCodeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const phone = body.phone?.replace(/-/g, '');
  const { code } = body;
  if (!phone || !code) {
    return NextResponse.json(
      { error: 'phone과 code는 필수입니다.' },
      { status: 400 },
    );
  }

  try {
    const { verified, token } = await verifyPhoneCode(phone, code);
    if (!verified) {
      return NextResponse.json(
        { error: '인증번호가 올바르지 않거나 만료되었습니다.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, phoneVerificationToken: token });
  } catch (err) {
    console.error('[auth/phone/verify-code] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
