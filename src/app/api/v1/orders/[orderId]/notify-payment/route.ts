import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import {
  getOrderByOrderIdAndUser,
  markOrderPendingConfirm,
  markOrderPaidFree,
} from '@/libs/supabase/queries/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/orders/{orderId}/notify-payment
 * 사용자가 "입금했다"는 알림을 서버에 전달해 주문 상태를 pending → pending_confirm으로 전환한다.
 * (원본: main/src/app/api/orders/notify-payment/route.ts — orderId는 body가 아닌 URL 파라미터로 받는다)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    const user = await requireBearerUser(request);

    const order = await getOrderByOrderIdAndUser(orderId, user.id);
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 알림 접수됐거나 완료된 경우 멱등성 처리
    if (order.status === 'pending_confirm' || order.status === 'paid') {
      return NextResponse.json({ success: true });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: '처리할 수 없는 주문 상태입니다.' }, { status: 409 });
    }

    let updated: boolean;
    try {
      // 무료 상품(amount=0)은 결제 승인 절차 자체가 없으므로 pending_confirm 단계 없이
      // 바로 paid로 전환한다 — 구매 즉시 마이페이지 보관함에서 다운로드 가능해야 하기 때문.
      updated =
        order.amount === 0
          ? await markOrderPaidFree(orderId, user.id)
          : await markOrderPendingConfirm(orderId, user.id);
    } catch (updateError) {
      console.error('[POST /api/v1/orders/[orderId]/notify-payment] update error:', updateError);
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!updated) {
      // 동시 요청으로 상태가 이미 변경된 경우 — 멱등성 처리
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/orders/[orderId]/notify-payment] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
