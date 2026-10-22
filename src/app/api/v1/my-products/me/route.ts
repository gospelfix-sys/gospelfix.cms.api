import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  getMyProducts,
  toApiProduct,
} from '@/libs/supabase/queries/products.my';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/my-products/me
 * 로그인한 seller/admin 본인이 등록한 상품 목록을 반환한다.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);
    const products = await getMyProducts(user.id);
    return NextResponse.json({ data: products.map(toApiProduct) });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error('[GET /api/v1/my-products/me] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
