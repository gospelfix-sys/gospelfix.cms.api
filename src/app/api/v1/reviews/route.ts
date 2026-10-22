import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { getReviewsByProductId, upsertReview } from '@/libs/supabase/queries/reviews';
import { hasPurchasedProduct } from '@/libs/supabase/queries/orders';
import { issueCoupon } from '@/libs/supabase/queries/coupons';
import { getPrimaryActiveReviewBanner } from '@/libs/supabase/queries/referral-banners.admin';

// "리뷰" 유형 활성 배너가 하나도 없을 때(마이그레이션 미적용 등)의 폴백값.
const DEFAULT_REVIEW_COUPON_DISCOUNT_RATE = 20;
const REVIEW_COUPON_VALID_DAYS = 30;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/reviews?product_id=xxx
 * 공개 조회 — 로그인 여부와 무관하게 동일한 응답을 반환하므로 Bearer 인증이 필요 없다.
 * (원본: main/src/lib/supabase/reviews.ts의 getReviewsByProductId)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const productId = request.nextUrl.searchParams.get('product_id');
  if (!productId) {
    return NextResponse.json({ error: 'product_id가 필요합니다.' }, { status: 400 });
  }

  try {
    const data = await getReviewsByProductId(productId);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[GET /api/v1/reviews] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/reviews
 * 로그인 + 구매 여부를 서버에서 재검증한 뒤 리뷰를 작성/수정(upsert)한다.
 * (원본: main/src/components/products/ReviewForm.tsx의 insert/update 로직)
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);

    const { productId, rating, content } = await request.json();

    if (!productId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: '리뷰 내용을 입력해주세요.' }, { status: 400 });
    }

    // 구매 여부 서버 재검증 (클라이언트 위변조 방지)
    const purchased = await hasPurchasedProduct(user.id, productId);
    if (!purchased) {
      return NextResponse.json(
        { error: '상품을 구매한 고객만 리뷰를 작성할 수 있습니다.' },
        { status: 403 },
      );
    }

    const { isFirstReview } = await upsertReview(user.id, productId, rating, content.trim());

    // 리뷰 작성 보상: 이 상품에 대한 최초 작성일 때만 쿠폰을 지급한다(수정은 재지급 안 함).
    // 할인율은 "롤링 배너 관리"에서 유형=리뷰인 배너 중 노출 순서가 가장 앞선 활성
    // 배너의 discount_rate를 사용한다(referrals.ts의 applyReferral()과 동일한 결정
    // 규칙). 실패해도 리뷰 작성 자체는 성공 처리되어야 하므로 별도로 감싼다.
    if (isFirstReview) {
      try {
        const reviewBanner = await getPrimaryActiveReviewBanner();
        const discountRate = reviewBanner?.discount_rate ?? DEFAULT_REVIEW_COUPON_DISCOUNT_RATE;
        await issueCoupon(user.id, discountRate, REVIEW_COUPON_VALID_DAYS, 'review');
      } catch (couponError) {
        console.error('[POST /api/v1/reviews] 리뷰 쿠폰 발급 실패:', couponError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/reviews] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
