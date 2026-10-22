import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { changePassword, AccountError } from '@/libs/supabase/queries/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChangePasswordRequestBody {
  currentPassword?: string;
  newPassword?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('account_password');
  if (disabledError) return disabledError;

  try {
    const user = await requireBearerUser(request);
    if (!user.email) {
      return NextResponse.json({ error: '이메일 정보가 없는 계정입니다.' }, { status: 400 });
    }

    let body: ChangePasswordRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'currentPassword와 newPassword는 필수입니다.' },
        { status: 400 },
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: '새 비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 },
      );
    }

    await changePassword(user.id, user.email, currentPassword, newPassword);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/password] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
