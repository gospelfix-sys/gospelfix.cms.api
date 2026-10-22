import { createAdminClient } from '@/libs/supabase/admin';
import { createClient } from '@/libs/supabase/server';

export class AccountError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AccountError';
  }
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  referral_code: string | null;
  seller_requested_at: string | null;
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, role, created_at, referral_code, seller_requested_at',
    )
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * 일반 회원이 "판매자가 되고 싶다"는 의사를 표시한다. 자동으로 role을 바꾸지
 * 않는다 — 관리자가 /users 페이지에서 이 신호를 보고 수동으로 seller로 전환한다
 * (project_product_crud_migration_to_mypage 메모리 — 신청제가 아니라 관리자
 * 수동 지정으로 확정된 정책, 이 함수는 그 판단을 돕는 신호만 남긴다).
 */
export async function requestSellerRole(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ seller_requested_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('role', 'user')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new AccountError(400, '이미 판매자이거나 신청할 수 없는 상태입니다.');
}

export async function updateProfile(
  userId: string,
  updates: { fullName?: string; avatarUrl?: string | null },
): Promise<void> {
  const patch: Record<string, string | null> = {};
  if (updates.fullName !== undefined) patch.full_name = updates.fullName;
  if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl;
  if (Object.keys(patch).length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * 아바타 파일을 avatars 버킷(Public)에 업로드하고 public URL을 반환한다.
 * service_role 클라이언트로 업로드하므로 avatars 버킷에 별도 RLS INSERT 정책이 없어도 동작한다.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new AccountError(400, 'jpg/png/webp 이미지만 업로드할 수 있습니다.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new AccountError(400, '파일 크기는 5MB 이하여야 합니다.');
  }

  const ext = file.type.split('/')[1];
  const path = `${userId}/${Date.now()}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return publicUrl;
}

/**
 * 비밀번호를 변경한다. 현재 비밀번호를 signInWithPassword로 먼저 재검증해
 * 세션(access_token) 탈취 상태에서의 비밀번호 변경을 막는다.
 */
export async function changePassword(
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const anonSupabase = createClient();
  const { error: signInError } = await anonSupabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError)
    throw new AccountError(401, '현재 비밀번호가 올바르지 않습니다.');

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}

/**
 * 소프트 탈퇴: 현재 비밀번호를 changePassword와 동일하게 재검증한 뒤(세션 탈취만으로는
 * 되돌릴 수 없는 계정 삭제를 실행할 수 없도록) Auth 계정을 사실상 영구 정지(ban)하고
 * profiles/auth.users의 PII를 마스킹한다. auth.users.email까지 마스킹해야 탈퇴 후
 * 같은 이메일로 재가입할 수 있다(안 하면 auth.users의 email UNIQUE 제약에 막혀 영구히
 * 재가입 불가). orders/reviews 등 결제·활동 기록은 user_id 참조를 그대로 남겨
 * 세금/분쟁 대비 보존한다(하드 삭제(users.ts의 deleteUser)는 관리자가 타 유저를
 * 완전히 지울 때만 사용). 이미 발급된 세션 폐기(전 기기 로그아웃)는 호출부(route.ts)가
 * 원본 access_token으로 logout/route.ts와 동일한 방식으로 별도 처리한다.
 */
export async function softDeleteAccount(
  userId: string,
  email: string,
  currentPassword: string,
): Promise<void> {
  const anonSupabase = createClient();
  const { error: signInError } = await anonSupabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError)
    throw new AccountError(401, '현재 비밀번호가 올바르지 않습니다.');

  const supabase = createAdminClient();
  const maskedEmail = `deleted_${userId}@deleted.gospelfix.local`;

  const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
    email: maskedEmail,
  });
  if (banError) throw new Error(banError.message);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      deleted_at: new Date().toISOString(),
      email: maskedEmail,
      full_name: null,
      avatar_url: null,
    })
    .eq('id', userId);
  if (profileError) throw new Error(profileError.message);
}

export interface MyReview {
  id: string;
  product_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  product: { name: string; thumbnail_url: string | null; slug: string } | null;
}

/** 본인이 작성한 리뷰 전체를 상품 정보(name/thumbnail/slug)와 함께 조회한다. */
export async function getMyReviews(userId: string): Promise<MyReview[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_reviews')
    .select(
      'id, product_id, rating, content, created_at, product:moda_products(name, thumbnail_url, slug)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MyReview[];
}
