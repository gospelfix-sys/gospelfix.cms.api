import { createAdminClient } from '@/libs/supabase/admin';
import { getPrimaryActiveSignupBanner } from '@/libs/supabase/queries/referral-banners.admin';

// 회원가입 혜택 쿠폰(발급/조회/검증/사용 처리)을 다루는 쿼리 모음.
// 쓰기는 이 저장소의 기존 컨벤션대로 항상 admin.ts(service_role)로만 수행한다.

// "회원가입" 유형 활성 배너가 하나도 없을 때(마이그레이션 미적용, 배너 미분류 등)의 폴백값.
const DEFAULT_SIGNUP_COUPON_DISCOUNT_RATE = 20;
const SIGNUP_COUPON_VALID_DAYS = 30;
// 혼동되는 0/O/1/I 제외. referrals.ts의 추천인 코드 생성도 동일 문자셋을 재사용한다.
export const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_GENERATION_ATTEMPTS = 5;

export type CouponSource = 'signup' | 'referral' | 'review';

export interface Coupon {
  id: string;
  code: string;
  discount_rate: number;
  is_used: boolean;
  // 할인 쿠폰은 계정당 1회만 사용 가능한 정책이므로, 이 쿠폰으로 주문을 시도한 적이 한 번이라도
  // 있으면(결제 완료는 물론, 결제를 마치지 않고 취소/이탈한 pending·cancelled 주문 포함) true.
  // is_used(실제 결제 완료 시점에만 true)와 달리 "시도 자체"를 기준으로 하므로, 상품 상세페이지의
  // 쿠폰 적용 UI는 is_used가 아니라 이 필드로 노출 여부를 판단해야 한다.
  is_locked: boolean;
  expired_at: string;
  created_at: string;
  source: CouponSource | null;
}

function randomSegment(length: number): string {
  let segment = '';
  for (let i = 0; i < length; i++) {
    segment += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return segment;
}

function generateCouponCode(): string {
  return `GF-${randomSegment(4)}-${randomSegment(4)}`;
}

/**
 * discountRate% 할인 쿠폰을 발급한다(유효기간 validDays일).
 * 코드 유니크 제약 위반(우연한 중복)이 발생하면 몇 차례 재시도한다.
 * 회원가입/추천인/리뷰 작성 등 발급 사유별로 이 함수를 호출한다.
 */
export async function issueCoupon(
  userId: string,
  discountRate: number,
  validDays: number,
  source: CouponSource,
): Promise<void> {
  const supabase = createAdminClient();
  const expiredAt = new Date(
    Date.now() + validDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const { error } = await supabase.from('moda_coupons').insert({
      user_id: userId,
      code: generateCouponCode(),
      discount_rate: discountRate,
      expired_at: expiredAt,
      source,
    });

    if (!error) return;
    // unique_violation(23505)이 아니면 재시도해도 소용없으므로 즉시 throw
    if (error.code !== '23505') throw new Error(error.message);
  }

  throw new Error('쿠폰 코드 생성에 반복적으로 실패했습니다.');
}

/**
 * 회원가입 즉시 발급되는 할인 쿠폰을 생성한다. 할인율은 "롤링 배너 관리"에서
 * 유형=회원가입인 배너 중 노출 순서가 가장 앞선 활성 배너의 discount_rate를
 * 사용한다(referrals.ts의 applyReferral(), reviews/route.ts와 동일한 결정 규칙).
 */
export async function issueSignupCoupon(userId: string): Promise<void> {
  const signupBanner = await getPrimaryActiveSignupBanner();
  const discountRate =
    signupBanner?.discount_rate ?? DEFAULT_SIGNUP_COUPON_DISCOUNT_RATE;
  return issueCoupon(userId, discountRate, SIGNUP_COUPON_VALID_DAYS, 'signup');
}

/**
 * 로그인 유저의 쿠폰 목록을 최신순으로 조회한다 (마이페이지 노출용).
 * 각 쿠폰마다 주문에 연결된 적이 있는지(is_locked, 취소된 주문 포함) 함께 계산해 반환한다.
 */
export async function getUserCoupons(userId: string): Promise<Coupon[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_coupons')
    .select('id, code, discount_rate, is_used, expired_at, created_at, source')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const coupons = (data ?? []) as Omit<Coupon, 'is_locked'>[];
  if (coupons.length === 0) return [];

  const couponIds = coupons.map((coupon) => coupon.id);
  // 계정당 1회용 정책: 상태를 가리지 않고(취소된 주문 포함) 이 쿠폰을 참조한 주문이
  // 하나라도 있으면 "이미 시도됨"으로 간주해 다시 노출하지 않는다.
  const { data: linkedOrders, error: ordersError } = await supabase
    .from('moda_orders')
    .select('coupon_id')
    .in('coupon_id', couponIds);

  if (ordersError) throw new Error(ordersError.message);
  const lockedCouponIds = new Set(
    (linkedOrders ?? []).map((order: { coupon_id: string }) => order.coupon_id),
  );

  return coupons.map((coupon) => ({
    ...coupon,
    is_locked: lockedCouponIds.has(coupon.id),
  }));
}

export interface ValidCoupon {
  id: string;
  discount_rate: number;
}

/**
 * 주문 생성 시 쿠폰 코드를 검증한다.
 * user_id 일치 + 미사용 + 만료 전 조건에 더해, 계정당 1회용 정책에 따라 이 쿠폰으로 주문을
 * 시도한 적이 한 번도 없어야 한다(취소된 주문 포함 — 상세페이지 UI의 is_locked 판단과 동일 기준).
 * UI에서 숨겨도 캐시된 쿠폰 코드로 직접 요청을 보낼 수 있으므로 서버에서도 동일하게 막는다.
 */
export async function validateCouponForOrder(
  userId: string,
  code: string,
): Promise<ValidCoupon | null> {
  const supabase = createAdminClient();
  const { data: coupon, error } = await supabase
    .from('moda_coupons')
    .select('id, discount_rate')
    .eq('user_id', userId)
    .eq('code', code)
    .eq('is_used', false)
    .gt('expired_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!coupon) return null;

  // coupon_id는 cancelled 주문까지 포함하면 유니크가 보장되지 않으므로(부분 유니크 인덱스는
  // 활성 상태만 커버) .limit(1)로 다건 매치 시 에러를 던지지 않게 막는다.
  const { data: existingOrder, error: orderError } = await supabase
    .from('moda_orders')
    .select('id')
    .eq('coupon_id', coupon.id)
    .limit(1)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (existingOrder) return null;

  return coupon as ValidCoupon;
}

/** 주문이 실제로 paid로 전환되는 시점에 호출해 쿠폰을 사용 처리한다. */
export async function markCouponUsed(couponId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('moda_coupons')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', couponId)
    .eq('is_used', false);

  if (error) throw new Error(error.message);
}
