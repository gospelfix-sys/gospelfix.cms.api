import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getPurchasedOrders } from '@/libs/supabase/queries/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders/me
 * 로그인한 유저 본인의 결제 완료(paid) 주문 목록을 상품 정보와 함께 반환한다.
 * (참고: main/src/lib/supabase/orders.ts의 getPurchasedOrders — 동일한 2단계 조회 패턴)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);
    const purchasedOrders = await getPurchasedOrders(user.id);

    const data = purchasedOrders.map((order) => ({
      orderId: order.order_id,
      paidAt: order.paid_at,
      amount: order.amount,
      product: order.product
        ? {
            id: order.product.id,
            name: order.product.name,
            thumbnailUrl: order.product.thumbnail_url,
            filePath: order.product.file_path,
          }
        : null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error('[GET /api/v1/orders/me] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
