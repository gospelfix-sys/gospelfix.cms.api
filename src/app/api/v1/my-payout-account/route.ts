import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  getPayoutAccount,
  upsertPayoutAccount,
  deletePayoutAccount,
} from '@/libs/supabase/queries/payout-accounts';
import { PayoutCryptoConfigError } from '@/libs/crypto/payoutAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 이 파일은 계좌번호를 다룬다 — 요청 body·번호를 로그에 남기지 않는다(오류는 메시지만).

function handleError(error: unknown, tag: string) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof PayoutCryptoConfigError) {
    console.error(`[${tag}] 암호화 설정 오류:`, error.message);
    return NextResponse.json(
      {
        error:
          '계좌 저장 기능이 아직 준비되지 않았습니다. 관리자에게 문의해주세요.',
      },
      { status: 503 },
    );
  }
  console.error(
    `[${tag}] unexpected error:`,
    error instanceof Error ? error.message : 'unknown',
  );
  return NextResponse.json(
    { error: '서버 오류가 발생했습니다.' },
    { status: 500 },
  );
}

/** GET /api/v1/my-payout-account — 본인 정산 계좌(번호는 끝 4자리만). */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);
    const data = await getPayoutAccount(user.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleError(error, 'GET /api/v1/my-payout-account');
  }
}

/** PUT /api/v1/my-payout-account — 정산 계좌 등록·교체(1인 1계좌). */
export async function PUT(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);

    const body = (await request.json()) as {
      bankName?: unknown;
      accountHolder?: unknown;
      accountNumber?: unknown;
    };
    const bankName =
      typeof body.bankName === 'string' ? body.bankName.trim() : '';
    const accountHolder =
      typeof body.accountHolder === 'string' ? body.accountHolder.trim() : '';
    // 하이픈·공백은 입력 편의상 허용하고 저장 전에 제거한다
    const accountNumber =
      typeof body.accountNumber === 'string'
        ? body.accountNumber.replace(/[\s-]/g, '')
        : '';

    if (!bankName || bankName.length > 30) {
      return NextResponse.json(
        { error: '은행을 선택해주세요.' },
        { status: 400 },
      );
    }
    if (accountHolder.length < 2 || accountHolder.length > 30) {
      return NextResponse.json(
        { error: '예금주를 2~30자로 입력해주세요.' },
        { status: 400 },
      );
    }
    if (!/^\d{8,20}$/.test(accountNumber)) {
      return NextResponse.json(
        { error: '계좌번호는 숫자 8~20자리로 입력해주세요.' },
        { status: 400 },
      );
    }

    const data = await upsertPayoutAccount(user.id, {
      bankName,
      accountHolder,
      accountNumber,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleError(error, 'PUT /api/v1/my-payout-account');
  }
}

/** DELETE /api/v1/my-payout-account — 등록한 정산 계좌 삭제. */
export async function DELETE(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);
    await deletePayoutAccount(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, 'DELETE /api/v1/my-payout-account');
  }
}
