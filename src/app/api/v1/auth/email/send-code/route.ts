import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import {
  CODE_TTL_MS,
  createEmailVerificationCode,
  EmailRateLimitError,
} from '@/libs/supabase/queries/email-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendCodeRequestBody {
  email?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('email_send_code');
  if (disabledError) return disabledError;

  let body: SendCodeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: '올바른 이메일 주소를 입력하세요.' },
      { status: 400 },
    );
  }

  try {
    await createEmailVerificationCode(email);
    return NextResponse.json({ success: true, expiresIn: CODE_TTL_MS / 1000 });
  } catch (err) {
    if (err instanceof EmailRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error('[auth/email/send-code] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
