import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { createClient } from '@/libs/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RefreshRequestBody {
  refreshToken?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: RefreshRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { refreshToken } = body;
  if (!refreshToken) {
    return NextResponse.json({ error: 'refreshToken은 필수입니다.' }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[auth/refresh] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
