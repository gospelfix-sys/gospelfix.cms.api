import { createAdminClient } from '@/libs/supabase/admin';

export interface AdminUserListItem {
  id: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin' | 'seller';
  created_at: string;
  // 일반 회원이 마이페이지에서 판매자 전환 의사를 표시한 시각. NULL이면 신청 안 함
  // (055/057 참고 — 자동 승인 없음, 이 화면에서 관리자가 수동으로 seller 전환)
  seller_requested_at: string | null;
  // 가입 경로. handle_new_user() 트리거가 raw_user_meta_data->>'provider'로 채운다
  // (이메일 가입은 이 키를 안 넘겨 기본값 'email', 카카오 로그인은 'kakao'를 명시)
  signup_provider: string;
}

/** 관리자 유저 관리 페이지용 전체 유저 목록을 최근 가입순으로 조회한다. */
export async function getAllUsers(): Promise<AdminUserListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, phone, role, created_at, seller_requested_at, signup_provider',
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserListItem[];
}

/**
 * 회원가입 전 휴대폰 번호 중복을 미리 확인한다. `profiles.phone`은 유니크 제약이 걸려 있어
 * 중복 시 handle_new_user() 트리거가 실패하며 GoTrue가 원인 상세 없이 빈 바디+500을 반환하는데,
 * signUp() 호출 전에 이 함수로 먼저 걸러내면 사용자에게 실제 원인을 알려줄 수 있다.
 */
export async function findProfileByPhone(
  phone: string,
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * 이메일로 기존 profiles row 존재 여부를 조회한다. 카카오 로그인처럼 비밀번호 없는
 * 가입 흐름에서 "신규 가입 vs 재로그인"을 identities 필드가 아니라 profiles row
 * 존재 여부로 판별하기 위해 이 함수를 auth.admin.createUser() 호출 **전에** 사용한다.
 */
export async function findProfileByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * auth.users에서 유저를 완전히 삭제한다. profiles row는
 * `on delete cascade`로 함께 제거되므로 별도 delete가 필요 없다.
 */
export async function deleteUser(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

/**
 * 유저의 role을 변경한다. service_role 클라이언트를 사용하므로
 * "role은 기존 값과 같아야 한다"는 profiles의 RLS 정책을 우회한다.
 * seller 전환은 판매자 마켓플레이스 셀프서비스 기능의 진입 경로다 — 신청제가
 * 아니라 관리자가 이 화면에서 수동으로 지정하는 방식으로 확정됐다
 * (project_product_crud_migration_to_mypage 메모리 참고).
 */
export async function updateUserRole(
  id: string,
  role: 'user' | 'admin' | 'seller',
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
