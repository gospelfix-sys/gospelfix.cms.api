import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { createAdminClient } from '@/libs/supabase/admin';
import {
  getProfileById,
  updateProfile,
  softDeleteAccount,
  AccountError,
} from '@/libs/supabase/queries/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const user = await requireBearerUser(request);

    const profile = await getProfileById(user.id);
    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ user, profile });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/me] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface UpdateMeRequestBody {
  fullName?: string;
  avatarUrl?: string;
}

export async function PATCH(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('account_update');
  if (disabledError) return disabledError;

  try {
    const user = await requireBearerUser(request);

    let body: UpdateMeRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    await updateProfile(user.id, { fullName: body.fullName, avatarUrl: body.avatarUrl });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/me] PATCH Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('account_delete');
  if (disabledError) return disabledError;

  try {
    const user = await requireBearerUser(request);
    if (!user.email) {
      return NextResponse.json({ error: '이메일 정보가 없는 계정입니다.' }, { status: 400 });
    }

    let body: { currentPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body.currentPassword) {
      return NextResponse.json({ error: 'currentPassword는 필수입니다.' }, { status: 400 });
    }

    // 되돌릴 수 없는 작업이므로 changePassword와 동일하게 현재 비밀번호를 재검증한다
    // (탈취된 세션만으로 계정을 영구 삭제할 수 없도록).
    await softDeleteAccount(user.id, user.email, body.currentPassword);

    // logout/route.ts와 동일한 방식: 현재 세션까지 포함해 이미 발급된 토큰을 전부 폐기한다.
    const authorizationHeader = request.headers.get('authorization');
    const accessToken = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : null;
    if (accessToken) {
      const adminSupabase = createAdminClient();
      const { error } = await adminSupabase.auth.admin.signOut(accessToken);
      if (error) console.error('[auth/me] DELETE admin.signOut error:', error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/me] DELETE Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
