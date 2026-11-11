import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/** 관리자 로그인 유지 시간: 로그인 후 8시간 */
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * 미들웨어 전용 Supabase 클라이언트
 * 요청/응답 객체에서 쿠키를 읽고 써서 세션을 자동 갱신한다
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
          );
        },
      },
    },
  );

  // 세션 갱신 (토큰 자동 refresh)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // refresh token은 만료가 없어 로그인이 무기한 유지되므로, 로그인 후 일정 시간이 지나면 재로그인시킨다.
  // last_sign_in_at은 토큰 갱신이 아니라 실제 로그인 때만 바뀐다.
  if (user?.last_sign_in_at) {
    const elapsed = Date.now() - new Date(user.last_sign_in_at).getTime();
    if (elapsed > ADMIN_SESSION_MAX_AGE_MS) {
      // 기본 scope(global)는 다른 기기 세션까지 끊으므로 현재 세션만 폐기한다.
      await supabase.auth.signOut({ scope: 'local' });
      return { supabaseResponse, user: null };
    }
  }

  return { supabaseResponse, user };
}
