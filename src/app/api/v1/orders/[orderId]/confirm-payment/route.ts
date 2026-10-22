import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  getOrderByOrderIdAndUser,
  markOrderPaid,
} from '@/libs/supabase/queries/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/orders/{orderId}/confirm-payment
 * 카카오페이 등 자동승인 결제가 완료됐다는 콜백을 받아 주문 상태를 즉시 paid로 전환한다.
 * 무통장입금(notify-payment)과 달리 pending_confirm 단계를 거치지 않는다.
 * 실제 결제 확정을 다루므로, update가 0건이면(동시 요청 경합) notify-payment처럼 무조건
 * success를 반환하지 않고 재조회해 진짜 멱등 재요청인지 확인한다.
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
      return NextResponse.json(
        { error: '주문 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const { paymentKey } = await request.json();
    if (!paymentKey || typeof paymentKey !== 'string') {
      return NextResponse.json(
        { error: 'paymentKey가 필요합니다.' },
        { status: 400 },
      );
    }

    const user = await requireBearerUser(request);

    const order = await getOrderByOrderIdAndUser(orderId, user.id);
    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (order.status === 'paid') {
      return NextResponse.json({ success: true });
    }

    if (order.status !== 'pending' && order.status !== 'pending_confirm') {
      return NextResponse.json(
        { error: '처리할 수 없는 주문 상태입니다.' },
        { status: 409 },
      );
    }

    let updated: boolean;
    try {
      updated = await markOrderPaid(orderId, user.id, paymentKey);
    } catch (updateError) {
      console.error(
        '[POST /api/v1/orders/[orderId]/confirm-payment] update error:',
        updateError,
      );
      return NextResponse.json(
        { error: '처리 중 오류가 발생했습니다.' },
        { status: 500 },
      );
    }

    if (!updated) {
      // 동시 요청으로 상태가 이미 바뀐 경우 — 실제로 paid가 됐는지 재조회해서 판단한다
      // (결제 확정 엔드포인트라 notify-payment처럼 무조건 성공 처리하지 않는다).
      const refetched = await getOrderByOrderIdAndUser(orderId, user.id);
      if (refetched?.status === 'paid') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: '처리할 수 없는 주문 상태입니다.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error(
      '[POST /api/v1/orders/[orderId]/confirm-payment] unexpected error:',
      error,
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
