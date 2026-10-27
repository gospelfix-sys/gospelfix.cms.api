import { NextResponse } from 'next/server';

import { getProfileById } from '@/libs/supabase/queries/account';
import { createClient } from '@/libs/supabase/server';

/**
 * Google OAuth 로그인 콜백 라우트
 * Google 로그인 후 Supabase가 이 URL로 code를 전달함
 * code를 세션으로 교환하고, 관리자(role=admin)만 통과시킨다.
 * 비관리자는 세션을 지워야 한다 — 남겨두면 미들웨어(로그인 상태의 /sign/in → /users)와
 * requireAdminPage(/users → /sign/in)가 서로 리다이렉트하는 무한 루프가 생긴다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/users';
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/users';

  const signInError = (reason: 'no_code' | 'auth_failed' | 'not_admin') =>
    NextResponse.redirect(`${origin}/sign/in?error=${reason}`);

  if (!code) return signInError('no_code');

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession', error.message);
    return signInError('auth_failed');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return signInError('not_admin');
  }

  return NextResponse.redirect(`${origin}${next}`);
}
