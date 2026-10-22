import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { uploadAvatar, AccountError } from '@/libs/supabase/queries/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 아바타 파일을 avatars 버킷(Public)에 업로드하고 public URL만 반환한다.
 * profiles.avatar_url 저장은 이 라우트가 하지 않는다 — 클라이언트가 받은 URL로
 * 뒤이어 PATCH /api/v1/auth/me를 호출해 저장한다(업로드/저장 책임 분리).
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('account_avatar');
  if (disabledError) return disabledError;

  try {
    const user = await requireBearerUser(request);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 });
    }

    const avatarUrl = await uploadAvatar(user.id, file);

    return NextResponse.json({ avatarUrl });
  } catch (err) {
    if (err instanceof AdminAuthError || err instanceof AccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/avatar] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
