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
    // 원문(영어) 메시지는 사용자 토스트에 그대로 노출되므로 로그에만 남기고 한국어로 응답한다.
    console.error('[POST /api/v1/my-products/images] error:', error);
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
