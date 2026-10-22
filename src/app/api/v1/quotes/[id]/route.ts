import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  getApiConfigBySlug,
  queryConfigDetail,
  InvalidIdentifierError,
} from '@/libs/supabase/queries/content-api-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/quotes/{id}
 * 정적 `quotes/` 디렉토리가 생기면서 제네릭 `/api/v1/[resource]/[identifier]/route.ts`가
 * 더 이상 이 경로를 처리하지 못하므로, 기존 단건 조회 동작을 동일하게 재현한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  const config = await getApiConfigBySlug('quotes');
  if (!config || !config.is_enabled) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const item = await queryConfigDetail(config, id);
    if (!item) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (err) {
    if (err instanceof InvalidIdentifierError) {
      return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
