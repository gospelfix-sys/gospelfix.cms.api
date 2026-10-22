import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getCartItems } from '@/libs/supabase/queries/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cart/me
 * 로그인한 유저 본인의 장바구니 목록을 상품 정보와 함께 반환한다.
 * (참고: orders/me/route.ts — getCartItems는 이미 camelCase로 반환하므로 추가 매핑 불필요)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);
    const data = await getCartItems(user.id);

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error('[GET /api/v1/cart/me] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
