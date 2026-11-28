import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import { getSellerIdentity } from '@/libs/supabase/queries/seller-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 휴대폰·이메일 등 개인정보를 담으므로 본인 Bearer로만 조회하고 캐시·로그에 남기지 않는다.

/**
 * GET /api/v1/my-seller-identity
 * 신청자·판매자 본인이 제출한 신원정보와 승인 상태를 돌려준다. 제출 전이면 data가 null.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);
    const identity = await getSellerIdentity(user.id);
    return NextResponse.json(
      { data: identity },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error(
      '[GET /api/v1/my-seller-identity] unexpected error:',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
