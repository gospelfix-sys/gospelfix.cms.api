import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getUserCoupons } from '@/libs/supabase/queries/coupons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/coupons/me
 * 로그인한 유저 본인의 쿠폰 목록을 반환한다 (마이페이지 "보유 쿠폰" 노출용).
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);
    const coupons = await getUserCoupons(user.id);

    const data = coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discountRate: coupon.discount_rate,
      isUsed: coupon.is_used,
      isLocked: coupon.is_locked,
      expiredAt: coupon.expired_at,
      createdAt: coupon.created_at,
      source: coupon.source,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error('[GET /api/v1/coupons/me] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
