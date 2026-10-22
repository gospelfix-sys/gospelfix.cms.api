import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { createAdminClient } from '@/libs/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    await requireBearerUser(request);

    // Authorization 헤더에서 원본 access_token을 다시 추출해 admin API로 실제 세션을 폐기한다.
    // requireBearerUser는 토큰 유효성 검증(User)만 반환하므로 원본 토큰이 필요하면 별도 파싱한다.
    const authorizationHeader = request.headers.get('authorization');
    const accessToken = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : null;

    if (accessToken) {
      const adminSupabase = createAdminClient();
      const { error } = await adminSupabase.auth.admin.signOut(accessToken);
      if (error) {
        // admin signOut이 실패해도 클라이언트 입장에서는 토큰을 폐기하면 그만이므로
        // 로그만 남기고 success로 응답한다.
        console.error('[auth/logout] admin.signOut error:', error.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/logout] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
