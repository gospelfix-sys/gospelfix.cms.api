import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { deleteCartItem } from '@/libs/supabase/queries/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/cart/{cartItemId}
 * 로그인한 유저 본인의 장바구니 항목을 삭제한다. 본인 소유가 아니면 404.
 * (원본: main/src/app/api/cart/[cartItemId]/route.ts)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cartItemId: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { cartItemId } = await params;
    if (!cartItemId) {
      return NextResponse.json({ error: '장바구니 항목 ID가 필요합니다.' }, { status: 400 });
    }

    const user = await requireBearerUser(request);

    const deleted = await deleteCartItem(user.id, cartItemId);
    if (!deleted) {
      return NextResponse.json({ error: '장바구니 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[DELETE /api/v1/cart/[cartItemId]] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
