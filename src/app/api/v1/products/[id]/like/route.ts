import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, getBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { getLikeStatus, toggleLike } from '@/libs/supabase/queries/product-likes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products/{id}/like
 * 공개 조회 — Bearer 토큰이 있으면 liked_by_me를 함께 반환하고, 없으면 항상 false.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const user = await getBearerUser(request);

  try {
    const status = await getLikeStatus(params.id, user?.id ?? null);
    if (!status) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ like_count: status.likeCount, liked_by_me: status.likedByMe });
  } catch (error) {
    console.error('[GET /api/v1/products/[id]/like] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/products/{id}/like
 * 로그인한 사용자 기준으로 좋아요를 토글한다(추가/취소). 사용자당 상품 1개당 1회로 제한된다
 * (product_likes.unique(product_id, user_id) 제약이 최종 방어선).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);

    const result = await toggleLike(params.id, user.id);
    if (!result) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ like_count: result.likeCount, liked: result.liked });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/products/[id]/like] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
