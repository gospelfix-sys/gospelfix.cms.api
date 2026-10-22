import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  createMyProduct,
  MyProductError,
  toApiProduct,
} from '@/libs/supabase/queries/products.my';
import type { MyProductInput } from '@/types/product';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/my-products
 * 로그인한 seller/admin 본인 명의로 상품을 새로 등록한다. is_active는 항상 false로
 * 시작 — 관리자 승인 후에만 공개 카탈로그에 노출된다.
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireSellerBearerUser(request);
    const input: MyProductInput = await request.json();

    const product = await createMyProduct(user.id, input);
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
      error instanceof Error ? error.message : '상품 등록에 실패했습니다.';
    console.error('[POST /api/v1/my-products] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
