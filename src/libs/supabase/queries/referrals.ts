import { createAdminClient } from '@/libs/supabase/admin';
import { CODE_CHARSET, issueCoupon } from '@/libs/supabase/queries/coupons';
import { getPrimaryActiveReferralBanner } from '@/libs/supabase/queries/referral-banners.admin';

// 추천인 코드(발급/조회/연결) 및 추천 보상 쿠폰 지급을 다루는 쿼리 모음.
// 쓰기는 이 저장소의 기존 컨벤션대로 항상 admin.ts(service_role)로만 수행한다.

const REFERRAL_CODE_LENGTH = 8;
const MAX_CODE_GENERATION_ATTEMPTS = 5;
const REFERRAL_COUPON_VALID_DAYS = 30;
// referral_banners에 활성 row가 하나도 없을 때(마이그레이션 미적용 등)의 폴백값.
const DEFAULT_REFERRAL_DISCOUNT_RATE = 50;

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return code;
}

/**
 * 사용자에게 공유용 추천인 코드를 발급해 profiles.referral_code에 저장한다.
 * 코드 유니크 제약 위반(우연한 중복)이 발생하면 몇 차례 재시도한다.
 */
export async function assignReferralCode(userId: string): Promise<string> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId);

    if (!error) return code;
    if (error.code !== '23505') throw new Error(error.message);
  }

  throw new Error('추천인 코드 생성에 반복적으로 실패했습니다.');
}

/** 추천인 코드로 해당 코드를 소유한 회원의 id를 조회한다. 없으면 null. */
export async function findProfileIdByReferralCode(code: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * 신규 가입자가 회원가입 시 추천인 코드를 입력했을 때 호출한다.
 * 코드가 유효하면 profiles.referred_by를 연결하고, 추천인·피추천인 양쪽에
 * 할인 쿠폰을 발급한다. 코드가 존재하지 않거나 자기 자신이면 조용히 무시한다
 * (신규 가입 시점엔 본인 코드가 아직 없어 자기추천은 사실상 불가능하지만
 * 방어적으로 둔다).
 *
 * 할인율은 referral_banners 중 sort_order가 가장 앞선 활성(is_enabled=true)
 * 배너의 discount_rate를 사용한다 — "지금 가장 먼저 보여지는 배너"와 "실제
 * 지급되는 혜택"을 일치시키는 결정 규칙. 활성 배너가 하나도 없어도(전부 꺼져
 * 있어도) 추천 프로그램 자체는 계속 동작해야 하므로 기본값으로 폴백한다.
 */
export async function applyReferral(newUserId: string, referralCode: string): Promise<void> {
  const referrerId = await findProfileIdByReferralCode(referralCode);
  if (!referrerId || referrerId === newUserId) return;

  const supabase = createAdminClient();

  const [, primaryBanner] = await Promise.all([
    (async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ referred_by: referrerId })
        .eq('id', newUserId);
      if (error) throw new Error(error.message);
    })(),
    getPrimaryActiveReferralBanner(),
  ]);

  const discountRate = primaryBanner?.discount_rate ?? DEFAULT_REFERRAL_DISCOUNT_RATE;

  await Promise.all([
    issueCoupon(newUserId, discountRate, REFERRAL_COUPON_VALID_DAYS, 'referral'),
    issueCoupon(referrerId, discountRate, REFERRAL_COUPON_VALID_DAYS, 'referral'),
  ]);
}
