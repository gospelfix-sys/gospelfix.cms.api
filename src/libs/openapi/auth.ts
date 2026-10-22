import { NextRequest, NextResponse } from 'next/server';
import { getAuthApiConfigBySlug } from '@/libs/supabase/queries/auth-api-configs';

export function validateApiKey(request: NextRequest): NextResponse | null {
  const validKey = process.env.INTERNAL_API_KEY;

  if (!validKey) {
    console.error('[Auth] INTERNAL_API_KEY is not set');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * /settings 페이지의 auth API 토글(auth_api_configs)이 꺼져 있으면 403을 반환한다.
 * 각 auth route.ts가 validateApiKey 다음 단계로 호출한다.
 */
export async function requireAuthApiEnabled(
  slug: string,
): Promise<NextResponse | null> {
  const config = await getAuthApiConfigBySlug(slug);
  if (config?.is_enabled === false) {
    return NextResponse.json(
      { error: '현재 비활성화된 API입니다.' },
      { status: 403 },
    );
  }
  return null;
}
