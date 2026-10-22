import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getPendingOrdersForUser } from '@/libs/supabase/queries/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders/me/pending
 * 로그인한 유저 본인의 결제 대기(pending/pending_confirm) 주문 목록을 상품 정보와 함께 반환한다.
 * 무통장입금 안내를 마이페이지에서 다시 확인할 수 있게 하기 위한 용도.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);
    const pendingOrders = await getPendingOrdersForUser(user.id);

    const data = pendingOrders.map((order) => ({
      orderId: order.order_id,
      status: order.status,
      amount: order.amount,
      createdAt: order.created_at,
      product: order.product
        ? {
            id: order.product.id,
            name: order.product.name,
            thumbnailUrl: order.product.thumbnail_url,
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
    console.error('[GET /api/v1/orders/me/pending] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
