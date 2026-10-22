import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  deleteMyProduct,
  getMyProductById,
  MyProductError,
  toApiProduct,
  updateMyProduct,
} from '@/libs/supabase/queries/products.my';
import type { MyProductInput } from '@/types/product';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/my-products/:id — 본인 소유 상품만 조회 가능 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  const { id } = await params;

  try {
    const user = await requireSellerBearerUser(request);
    const product = await getMyProductById(user.id, id);
    if (!product) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: toApiProduct(product) });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error('[GET /api/v1/my-products/[id]] unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/my-products/:id — 본인 소유 상품만 수정 가능.
 * 아직 최초 승인을 받지 못한 상품(draft/pending/rejected)은 수정 시 재검수 대상이 되지만,
 * 이미 승인된(approved) 상품은 재검수 없이 내용이 즉시 반영된다 (updateMyProduct 참고).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  const { id } = await params;

  try {
    const user = await requireSellerBearerUser(request);
    const input: MyProductInput = await request.json();

    const product = await updateMyProduct(user.id, id, input);
    return NextResponse.json({ data: toApiProduct(product) });
  } catch (error) {
    if (error instanceof MyProductError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: error.status },
      );
    }
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : '상품 수정에 실패했습니다.';
    console.error('[PATCH /api/v1/my-products/[id]] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/v1/my-products/:id — 본인 소유 상품만 삭제 가능 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  const { id } = await params;

  try {
    const user = await requireSellerBearerUser(request);
    await deleteMyProduct(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : '상품 삭제에 실패했습니다.';
    console.error('[DELETE /api/v1/my-products/[id]] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
