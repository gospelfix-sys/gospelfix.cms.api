import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getOwnPayoutAccountForTransfer } from '@/libs/supabase/queries/payout-accounts';
import { PayoutCryptoConfigError } from '@/libs/crypto/payoutAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 이 파일은 계좌번호 평문을 응답으로 내보낸다 — 번호·응답 body를 로그에 남기지 않는다(오류는 메시지만).

/**
 * GET /api/v1/my-payout-account/transfer
 * 판매자 본인이 마이페이지에서 자기 계좌의 송금 QR을 만들 수 있게 은행·번호·예금주를 돌려준다.
 * 본인 계좌만 조회되며(판매자 Bearer 기준), 공개 화면·구매자 화면에는 쓰지 않는다.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);
    const account = await getOwnPayoutAccountForTransfer(user.id);
    if (!account) {
      return NextResponse.json(
        { error: '등록된 정산 계좌가 없습니다.' },
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
        '[GET /api/v1/my-payout-account/transfer] 암호화 설정 오류:',
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
      '[GET /api/v1/my-payout-account/transfer] unexpected error:',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
