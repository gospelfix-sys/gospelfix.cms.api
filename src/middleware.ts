import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/libs/supabase/middleware';

const ADMIN_PATHS = ['/users', '/orders', '/quotes', '/blog', '/products', '/category', '/product-categories', '/product-sub-categories', '/portfolio', '/profile', '/settings', '/referral-banners'];

function isPublicApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/v1/') || pathname === '/api/openapi.json';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS Preflight — 공개 API 경로에 한해서만 처리
  if (request.method === 'OPTIONS') {
    if (!isPublicApiPath(pathname)) return new NextResponse(null, { status: 405 });

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 공개 API(/api/v1/*, /api/openapi.json)는 X-API-Key가 보안 레이어이므로
  // 세션 조회 없이 바로 통과시키고 CORS 헤더만 주입한다.
  if (isPublicApiPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Accept');
    return response;
  }

  // Supabase 세션 갱신 + 현재 로그인 사용자 조회 (관리자 role 여부는 각 페이지/액션의
  // requireAdminPage()/requireAdminApi()가 profiles.role로 별도 검증한다)
  const { supabaseResponse, user } = await updateSession(request);
  const isAuthenticated = !!user;

  // /api/auth/me — 인증된 사용자만 접근 가능
  if (pathname === '/api/auth/me' && !isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 루트 접속 → 인증 여부에 따라 분기
  if (pathname === '/') {
    const target = isAuthenticated ? '/users' : '/sign/in';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // 이미 로그인된 상태에서 /sign/in 접속 → /users로 이동
  if (pathname === '/sign/in' && isAuthenticated) {
    return NextResponse.redirect(new URL('/users', request.url));
  }

  // API 문서 페이지 — 로그인된 관리자만 접근 가능
  if (pathname === '/api-docs' || pathname.startsWith('/api-docs/')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/sign/in', request.url));
    }
    return supabaseResponse;
  }

  // 어드민 경로 미인증 접근 차단
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isAdminPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/sign/in', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/',
    '/sign/in',
    '/api/auth/me',
    '/api/v1/:path*',
    '/api/openapi.json',
    '/api-docs/:path*',
    '/users/:path*',
    '/orders/:path*',
    '/quotes/:path*',
    '/blog/:path*',
    '/products/:path*',
    '/category/:path*',
    '/product-categories/:path*',
    '/product-sub-categories/:path*',
    '/portfolio/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/referral-banners/:path*',
  ],
};
