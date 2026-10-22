import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import {
  createPhoneVerificationCode,
  PhoneRateLimitError,
} from '@/libs/supabase/queries/phone-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendCodeRequestBody {
  phone?: string;
}

const PHONE_REGEX = /^01[0-9]{8,9}$/;

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('phone_send_code');
  if (disabledError) return disabledError;

  let body: SendCodeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const phone = body.phone?.replace(/-/g, '');
  if (!phone || !PHONE_REGEX.test(phone)) {
    return NextResponse.json(
      { error: '올바른 휴대폰 번호를 입력하세요.' },
      { status: 400 },
    );
  }

  try {
    await createPhoneVerificationCode(phone);
    return NextResponse.json({ success: true, expiresIn: 180 });
  } catch (err) {
    if (err instanceof PhoneRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error('[auth/phone/send-code] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
