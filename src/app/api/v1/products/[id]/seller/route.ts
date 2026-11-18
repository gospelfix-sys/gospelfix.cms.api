import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { getProductSellerInfo } from '@/libs/supabase/queries/product-seller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products/{id}/seller
 * 공개 조회 — 상품 등록일과 판매자 공개 정보(이름·프로필 이미지·가린 아이디)를 반환한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const info = await getProductSellerInfo(params.id);
    if (!info) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: info });
  } catch (error) {
    console.error('[GET /api/v1/products/[id]/seller] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
