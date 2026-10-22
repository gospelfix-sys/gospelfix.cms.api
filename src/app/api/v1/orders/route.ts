import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { getApiConfigBySlug, queryConfigList } from '@/libs/supabase/queries/content-api-configs';
import { getActiveProductById } from '@/libs/supabase/queries/products';
import {
  hasPurchasedProduct,
  createPendingOrder,
  CouponConflictError,
} from '@/libs/supabase/queries/orders';
import { validateCouponForOrder } from '@/libs/supabase/queries/coupons';
import { getEffectivePrice } from '@/libs/pricing/productPriceState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders
 * 이 파일(정적 라우트)이 제네릭 `/api/v1/[resource]/route.ts`보다 우선 매칭되므로,
 * 기존 CMS 목록 조회 기능(관리자가 orders 리소스를 활성화한 경우)이 깨지지 않도록
 * 동일한 제네릭 로직을 그대로 재사용한다.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const config = await getApiConfigBySlug('orders');
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
 * POST /api/v1/orders
 * main 앱의 결제 위젯이 결제를 시작하기 전 주문 레코드를 pending 상태로 생성한다.
 * (원본: main/src/app/api/orders/create/route.ts — 쿠키 세션 대신 Bearer 토큰으로 사용자를 식별)
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { productId, amount, agreedToWithdrawalNotice, couponCode } = await request.json();

    if (!productId || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    if (agreedToWithdrawalNotice !== true) {
      return NextResponse.json(
        { error: '청약철회 제한 안내 동의가 필요합니다.' },
        { status: 400 },
      );
    }

    const user = await requireBearerUser(request);

    // 상품 가격 서버에서 재검증 (클라이언트 위변조 방지)
    const product = await getActiveProductById(productId);
    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const basePrice = getEffectivePrice(product);

    // 쿠폰은 유료 상품에만 적용 가능. 무료 상품(basePrice=0)에는 쿠폰 코드가 와도 무시한다.
    let couponId: string | null = null;
    let discountAmount = 0;
    if (couponCode && basePrice > 0) {
      const coupon = await validateCouponForOrder(user.id, couponCode);
      if (!coupon) {
        return NextResponse.json({ error: '유효하지 않은 쿠폰입니다.' }, { status: 400 });
      }
      couponId = coupon.id;
      discountAmount = Math.floor((basePrice * coupon.discount_rate) / 100);
    }

    if (basePrice - discountAmount !== amount) {
      return NextResponse.json({ error: '결제 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    // 동일 상품 중복 구매 방지
    const alreadyPurchased = await hasPurchasedProduct(user.id, productId);
    if (alreadyPurchased) {
      return NextResponse.json({ error: '이미 구매한 상품입니다.' }, { status: 409 });
    }

    // 고유 주문 ID 생성 (Toss 요구사항: 영문/숫자/특수문자 6~64자)
    const orderId = crypto.randomUUID();

    try {
      await createPendingOrder({
        userId: user.id,
        productId,
        orderId,
        amount,
        agreedToWithdrawalNotice,
        couponId,
        discountAmount,
      });
    } catch (insertError) {
      if (insertError instanceof CouponConflictError) {
        return NextResponse.json({ error: insertError.message }, { status: 409 });
      }
      console.error('[POST /api/v1/orders] insert error:', insertError);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ orderId });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/orders] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
