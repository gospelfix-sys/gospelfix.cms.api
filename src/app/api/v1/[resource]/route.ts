import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  getApiConfigBySlug,
  queryConfigList,
} from '@/libs/supabase/queries/content-api-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { resource } = await params;
  const config = await getApiConfigBySlug(resource);
  if (!config || !config.is_enabled) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
  const sortBy = searchParams.get('sort_by');
  const priceTypeParam = searchParams.get('price_type');
  const priceType = priceTypeParam === 'free' || priceTypeParam === 'premium' ? priceTypeParam : null;

  try {
    const { data, total } = await queryConfigList(config, page, limit, { sortBy, priceType });
    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
