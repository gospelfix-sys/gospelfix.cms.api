import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import {
  requireSellerBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  MyProductError,
  uploadMyProductFile,
} from '@/libs/supabase/queries/products.my';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/my-products/images
 * 상품 썸네일/본문 이미지 업로드. 브라우저가 아니라 이 서버가 Storage에 직접
 * 업로드한다(seller에게 Storage anon key를 노출하지 않기 위한 결정).
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    await requireSellerBearerUser(request);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file 필드가 필요합니다.' },
        { status: 400 },
      );
    }

    const { publicUrl } = await uploadMyProductFile(
      file,
      'products-images',
      'seller-uploads',
    );
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    if (error instanceof AdminAuthError || error instanceof MyProductError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
    console.error('[POST /api/v1/my-products/images] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
