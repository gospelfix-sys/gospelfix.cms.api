import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getOrderSellerForPayment } from '@/libs/supabase/queries/orders';
import { getBuyerVisiblePayoutAccount } from '@/libs/supabase/queries/payout-accounts';
import { PayoutCryptoConfigError } from '@/libs/crypto/payoutAccount';
import { isSellerDirectTransferEnabled } from '@/libs/payout/sellerDirectTransfer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 이 파일은 계좌번호 평문을 응답으로 내보낸다 — 번호·응답 body를 로그에 남기지 않는다(오류는 메시지만).

/**
 * GET /api/v1/orders/{orderId}/payout-account
 * 입금 안내 모달이 본인의 pending 주문에 한해 판매자 계좌(은행·번호·예금주)를 조회한다.
 * 주문 소유자·pending 상태·판매자 동의 3가지를 모두 서버에서 검증하며, 공개 화면에는 쓰지 않는다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  if (!isSellerDirectTransferEnabled()) {
    return NextResponse.json(
      { error: '계좌이체 결제를 준비 중입니다. 잠시 후 다시 이용해주세요.' },
      { status: 404 },
    );
  }

  try {
    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json(
        { error: '주문 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const user = await requireBearerUser(request);

    const order = await getOrderSellerForPayment(orderId, user.id);
    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    // 입금 대기 중일 때만 보여준다(완료·취소 후 재조회 방지)
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: '입금 대기 중인 주문이 아닙니다.' },
        { status: 409 },
      );
    }
    // 입금이 필요 없는 무료 주문으로 판매자 계좌를 조회하지 못하게 한다
    if (order.amount <= 0) {
      return NextResponse.json(
        { error: '입금이 필요한 주문이 아닙니다.' },
        { status: 409 },
      );
    }
    if (!order.sellerId) {
      return NextResponse.json(
        { error: '판매자 입금 계좌가 등록되지 않은 상품입니다.' },
        { status: 404 },
      );
    }

    const account = await getBuyerVisiblePayoutAccount(order.sellerId);
    if (!account) {
      return NextResponse.json(
        { error: '판매자가 아직 입금 계좌를 등록하지 않았습니다.' },
        { status: 404 },
      );
    }

    // 계좌번호 평문이므로 어떤 캐시에도 남지 않게 한다
    return NextResponse.json(
      { data: account },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof PayoutCryptoConfigError) {
      console.error(
        '[GET /api/v1/orders/[orderId]/payout-account] 암호화 설정 오류:',
        error.message,
      );
      return NextResponse.json(
        {
          error:
            '계좌 안내 기능이 아직 준비되지 않았습니다. 관리자에게 문의해주세요.',
        },
        { status: 503 },
      );
    }
    console.error(
      '[GET /api/v1/orders/[orderId]/payout-account] unexpected error:',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
