import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { hasPurchasedProduct } from '@/libs/supabase/queries/orders';
import { getProductFileInfo } from '@/libs/supabase/queries/products';
import { createSignedDownloadUrl } from '@/libs/supabase/queries/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_EXPIRES_IN_SECONDS = 300;

/**
 * GET /api/v1/downloads/{productId}
 * 구매 완료(paid)한 유저에게만 zip 다운로드용 signed URL을 발급한다.
 * main 앱은 서버 사이드(자신의 Route Handler)에서 이 API를 호출하는 구조이므로,
 * 브라우저를 바로 302 리다이렉트하지 않고 JSON으로 signed URL을 반환한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: '상품 ID가 필요합니다.' }, { status: 400 });
    }

    const user = await requireBearerUser(request);

    const purchased = await hasPurchasedProduct(user.id, productId);
    if (!purchased) {
      return NextResponse.json({ error: '구매한 상품만 다운로드할 수 있습니다.' }, { status: 403 });
    }

    const product = await getProductFileInfo(productId);
    if (!product?.file_path) {
      return NextResponse.json({ error: '다운로드 파일이 준비되지 않았습니다.' }, { status: 404 });
    }

    const url = await createSignedDownloadUrl(product.file_path, SIGNED_URL_EXPIRES_IN_SECONDS);
    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000).toISOString();

    return NextResponse.json({ url, expiresAt });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[GET /api/v1/downloads/[productId]] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
