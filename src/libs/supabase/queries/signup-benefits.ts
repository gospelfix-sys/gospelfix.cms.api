import { issueSignupCoupon } from '@/libs/supabase/queries/coupons';
import {
  assignReferralCode,
  applyReferral,
} from '@/libs/supabase/queries/referrals';

/**
 * 신규 가입자에게 가입 쿠폰 발급, 추천인 코드 부여, 추천인 적용을 함께 처리한다.
 * 이메일 가입(auth/signup)과 카카오 로그인(auth/kakao) 모두 이 헬퍼를 공유한다 —
 * 각 단계는 독립적으로 실패를 격리해(하나가 실패해도 가입 자체는 막지 않음) 로그만 남긴다.
 */
export async function applySignupBenefits(
  userId: string,
  referralCode?: string,
): Promise<void> {
  try {
    await issueSignupCoupon(userId);
  } catch (couponError) {
    console.error('[signup-benefits] 쿠폰 발급 실패:', couponError);
  }

  try {
    await assignReferralCode(userId);
  } catch (referralCodeError) {
    console.error(
      '[signup-benefits] 추천인 코드 발급 실패:',
      referralCodeError,
    );
  }

  if (referralCode) {
    try {
      await applyReferral(userId, referralCode.trim().toUpperCase());
    } catch (referralError) {
      console.error('[signup-benefits] 추천인 적용 실패:', referralError);
    }
  }
}
