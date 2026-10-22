import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { getApiConfigBySlug, queryConfigList } from '@/libs/supabase/queries/content-api-configs';
import { getActiveProductById } from '@/libs/supabase/queries/products';
import { addCartItem } from '@/libs/supabase/queries/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cart
 * 이 파일(정적 라우트)이 제네릭 `/api/v1/[resource]/route.ts`보다 우선 매칭되므로,
 * 관리자가 cart 리소스를 활성화한 경우를 위해 기존 CMS 제네릭 목록 조회를 재사용한다.
 * (원본 패턴: orders/route.ts)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const config = await getApiConfigBySlug('cart');
  if (!config || !config.is_enabled) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

  try {
    const { data, total } = await queryConfigList(config, page, limit);
    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/cart
 * 로그인한 유저가 상품+옵션을 장바구니에 담는다. 결제가 발생하지 않으므로
 * 상품 존재/활성 여부만 검증하고, 옵션명/가격은 클라이언트가 보낸 값을 스냅샷으로 저장한다.
 * (원본: main/src/app/api/cart/add/route.ts)
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { productId, optionId, optionLabel, price } = await request.json();

    if (
      !productId ||
      !optionId ||
      !optionLabel ||
      typeof price !== 'number' ||
      price < 0
    ) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const user = await requireBearerUser(request);

    const product = await getActiveProductById(productId);
    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    try {
      await addCartItem({
        userId: user.id,
        productId,
        optionId,
        optionLabel,
        price,
      });
    } catch (insertError) {
      console.error('[POST /api/v1/cart] insert error:', insertError);
      return NextResponse.json({ error: '장바구니 담기에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/cart] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
