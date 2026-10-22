import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { createClient } from '@/libs/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LoginRequestBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('login');
  if (disabledError) return disabledError;

  let body: LoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: 'email과 password는 필수입니다.' },
      { status: 400 },
    );
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 },
      );
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
    console.error('[auth/login] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
