import { createAdminClient } from '@/libs/supabase/admin';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_SELECT_COLUMNS =
  'id,message,discount_rate,is_enabled,show_referral_actions,banner_type,sort_order,created_at,updated_at';

export type BannerType = 'referral' | 'review' | 'general' | 'signup';

export interface ReferralBanner {
  id: string;
  message: string;
  discount_rate: number;
  is_enabled: boolean;
  show_referral_actions: boolean;
  banner_type: BannerType;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ReferralBannerFormInput {
  message: string;
  discount_rate: number;
  is_enabled: boolean;
  show_referral_actions: boolean;
  banner_type: BannerType;
}

function assertValidUUID(id: string): void {
  if (!id || !UUID_REGEX.test(id)) throw new Error('유효하지 않은 배너 ID입니다.');
}

export async function getAllReferralBanners(): Promise<ReferralBanner[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_banners')
    .select(ADMIN_SELECT_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getAllReferralBanners]', error);
    throw new Error('배너 목록을 불러오지 못했습니다.');
  }
  return (data ?? []) as unknown as ReferralBanner[];
}

export async function getReferralBannerByIdAdmin(id: string): Promise<ReferralBanner | null> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_banners')
    .select(ADMIN_SELECT_COLUMNS)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[getReferralBannerByIdAdmin]', error);
    throw new Error('배너를 불러오지 못했습니다.');
  }
  return data as unknown as ReferralBanner;
}

export async function createReferralBanner(
  input: ReferralBannerFormInput,
): Promise<ReferralBanner> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_banners')
    .insert(input)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[createReferralBanner]', error);
    throw new Error('배너 저장에 실패했습니다.');
  }
  return data as unknown as ReferralBanner;
}

export async function updateReferralBanner(
  id: string,
  input: ReferralBannerFormInput,
): Promise<ReferralBanner> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_banners')
    .update(input)
    .eq('id', id)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[updateReferralBanner]', error);
    throw new Error('배너 수정에 실패했습니다.');
  }
  return data as unknown as ReferralBanner;
}

export async function deleteReferralBanner(id: string): Promise<void> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { error } = await supabase.from('referral_banners').delete().eq('id', id);
  if (error) {
    console.error('[deleteReferralBanner]', error);
    throw new Error('배너 삭제에 실패했습니다.');
  }
}

// 복제본은 목록 맨 뒤(가장 큰 sort_order + 1)에 추가한다 — products.admin.ts의
// duplicateProduct처럼 원본 바로 다음 위치로 끼워넣기 위해 기존 행 전체의
// sort_order를 재배치하지는 않는다(배너는 항목 수가 적고 관리자가 드래그로
// 바로 재정렬하므로, 이 정도 단순화가 과도한 엔지니어링을 피하면서도 충분함).
export async function duplicateReferralBanner(id: string): Promise<ReferralBanner> {
  const original = await getReferralBannerByIdAdmin(id);
  if (!original) throw new Error('배너를 찾을 수 없습니다.');

  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from('referral_banners')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('referral_banners')
    .insert({
      message: `${original.message} (복사본)`,
      discount_rate: original.discount_rate,
      is_enabled: false,
      show_referral_actions: original.show_referral_actions,
      banner_type: original.banner_type,
      sort_order: nextSortOrder,
    })
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[duplicateReferralBanner]', error);
    throw new Error('배너 복사에 실패했습니다.');
  }
  return data as unknown as ReferralBanner;
}

export async function updateReferralBannersSortOrder(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const supabase = createAdminClient();
  const results = await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('referral_banners').update({ sort_order }).eq('id', id),
    ),
  );
  const failed = results.find(({ error }) => error);
  if (failed?.error) {
    console.error('[updateReferralBannersSortOrder]', failed.error);
    throw new Error('순서 저장에 실패했습니다.');
  }
}

/**
 * 특정 유형(banner_type) + 활성(is_enabled=true) 배너 중 sort_order가 가장 앞선
 * 1건을 조회한다. "지금 가장 먼저 보여지는 배너"와 "실제 지급되는 혜택"을
 * 일치시키는 결정 규칙을 유형별로 동일하게 적용하기 위한 공용 헬퍼.
 * row가 없으면 null(호출부가 기본 할인율로 폴백).
 */
async function getPrimaryActiveBannerByType(type: BannerType): Promise<ReferralBanner | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('referral_banners')
    .select(ADMIN_SELECT_COLUMNS)
    .eq('is_enabled', true)
    .eq('banner_type', type)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error(`[getPrimaryActiveBannerByType:${type}]`, error);
  if (error || !data) return null;
  return data as unknown as ReferralBanner;
}

/** referrals.ts의 applyReferral()이 실제 추천 쿠폰 할인율을 결정하는 데 사용한다. */
export async function getPrimaryActiveReferralBanner(): Promise<ReferralBanner | null> {
  return getPrimaryActiveBannerByType('referral');
}

/** reviews/route.ts가 실제 리뷰 작성 보상 쿠폰 할인율을 결정하는 데 사용한다. */
export async function getPrimaryActiveReviewBanner(): Promise<ReferralBanner | null> {
  return getPrimaryActiveBannerByType('review');
}

/** coupons.ts의 issueSignupCoupon()이 실제 회원가입 혜택 쿠폰 할인율을 결정하는 데 사용한다. */
export async function getPrimaryActiveSignupBanner(): Promise<ReferralBanner | null> {
  return getPrimaryActiveBannerByType('signup');
}
