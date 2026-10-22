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
 * POST /api/v1/my-products/files
 * 무료 상품 다운로드용 zip 업로드. private 버킷(product-files)이라 publicUrl 없이
 * Storage 객체 경로(path)만 반환한다 — 실제 다운로드는 downloads 엔드포인트가
 * 구매 인증 후 signed URL을 발급한다.
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
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'zip 파일만 업로드할 수 있습니다.' },
        { status: 400 },
      );
    }

    const { path } = await uploadMyProductFile(
      file,
      'product-files',
      'seller-uploads',
    );
    return NextResponse.json({ path });
  } catch (error) {
    if (error instanceof AdminAuthError || error instanceof MyProductError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : '파일 업로드에 실패했습니다.';
    console.error('[POST /api/v1/my-products/files] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
