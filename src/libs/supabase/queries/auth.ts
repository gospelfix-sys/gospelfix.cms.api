import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server';
import { createAdminClient } from '@/libs/supabase/admin';
import type { User } from '@supabase/supabase-js';

export class AdminAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AdminAuthError';
  }
}

/**
 * main 등 외부 서버가 `Authorization: Bearer <supabase_access_token>` 헤더로 넘겨준
 * 토큰의 주인을 검증한다. main은 자신의 httpOnly 쿠키에서 access_token을 읽어
 * 이 헤더에 그대로 forward한다(main과 cms.api가 같은 Supabase 프로젝트를 쓰므로
 * 토큰이 그대로 유효하다).
 */
function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * `/api/v1/*` 중 사용자 인증이 필요한 라우트(orders, reviews 등)에서 사용.
 * Bearer 토큰이 없거나 유효하지 않으면 AdminAuthError(401)를 throw한다.
 */
export async function requireBearerUser(request: NextRequest): Promise<User> {
  const token = extractBearerToken(request);
  if (!token) throw new AdminAuthError(401, 'Unauthorized');

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AdminAuthError(401, 'Unauthorized');

  return data.user;
}

/**
 * `/api/v1/my-products/*`에서 사용. Bearer 토큰 검증 + profiles.role이
 * seller/admin인지 확인한다 — 아니면 AdminAuthError(403)를 throw한다.
 */
export async function requireSellerBearerUser(
  request: NextRequest,
): Promise<User> {
  const user = await requireBearerUser(request);
  const role = await getAdminProfileRole(user.id);
  if (role !== 'seller' && role !== 'admin') {
    throw new AdminAuthError(403, '판매자 권한이 필요합니다.');
  }
  return user;
}

/**
 * Bearer 토큰이 있으면 검증해서 사용자를 반환하고, 없거나 무효하면 null을 반환한다
 * (리뷰 조회처럼 로그인 여부에 따라 응답이 달라지지 않는 공개 엔드포인트에서 사용).
 */
export async function getBearerUser(
  request: NextRequest,
): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

async function getAdminProfileRole(userId: string): Promise<string | null> {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

/**
 * 페이지 / Server Action에서 사용. 미인증·비관리자면 /sign/in으로 redirect한다.
 */
export async function requireAdminPage(): Promise<User> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign/in');

  const role = await getAdminProfileRole(user.id);
  if (role !== 'admin') redirect('/sign/in');

  return user;
}

/**
 * `/api/v1/admin/*` Route Handler에서 사용. 미인증·비관리자면 AdminAuthError를 throw한다.
 * 호출부에서 catch해 401/403 JSON 응답으로 변환할 것.
 */
export async function requireAdminApi(): Promise<{ user: User; role: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AdminAuthError(401, 'Unauthorized');

  const role = await getAdminProfileRole(user.id);
  if (role !== 'admin') throw new AdminAuthError(403, 'Forbidden');

  return { user, role };
}

/**
 * `/api/v1/auth/me`, AuthProvider 등에서 사용. redirect/throw 없이 조회만 한다.
 */
export async function getCurrentAdminUser(): Promise<{
  user: User;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  };
} | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role')
    .eq('id', user.id)
    .single();
  if (!profile) return null;

  return { user, profile };
}
