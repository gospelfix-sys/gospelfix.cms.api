import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import {
  getOrdersByOrderIdsAndUser,
  markOrdersPendingConfirm,
} from '@/libs/supabase/queries/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/orders/notify-payment-batch
 * 장바구니 배치 결제에서 사용자가 "입금했다"는 알림을 한 번에 전달해, 선택한 여러 주문을
 * pending → pending_confirm으로 전환한다. 이미 pending_confirm/paid인 주문은 자연히
 * 스킵되므로(멱등) 재요청해도 안전하다.
 * (참고: main/src/components/cart/BatchPaymentModal, [orderId]/notify-payment/route.ts)
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { orderIds } = (await request.json()) as { orderIds?: string[] };

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    const user = await requireBearerUser(request);

    const orders = await getOrdersByOrderIdsAndUser(orderIds, user.id);
    if (orders.length !== orderIds.length) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    try {
      await markOrdersPendingConfirm(orderIds, user.id);
    } catch (updateError) {
      console.error('[POST /api/v1/orders/notify-payment-batch] update error:', updateError);
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/orders/notify-payment-batch] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
