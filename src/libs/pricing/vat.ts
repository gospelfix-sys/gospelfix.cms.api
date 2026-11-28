import type { SellerTaxType } from '@/libs/nts/businessVerify';

// 일반과세자 상품의 결제 총액 = 공급가액 + 부가세. 서버가 권위이고, 앱(gospelfix)의
// src/lib/vat.ts가 같은 규칙으로 표시용 금액을 계산한다 — 한쪽을 바꾸면 반드시 같이 바꾼다.
// 테스트 벡터: 65,000 → vat 6,500 → total 71,500 / 12,345 → vat 1,234 → total 13,579 / 0 → 0

export const VAT_RATE_PERCENT = 10;

export interface VatBreakdown {
  supply: number;
  vat: number;
  total: number;
}

/** 공급가액에서 부가세(원 단위 내림)와 총액을 계산한다. */
export function computeVat(supply: number): VatBreakdown {
  const vat = Math.floor((supply * VAT_RATE_PERCENT) / 100);
  return { supply, vat, total: supply + vat };
}

/** 가산 스위치(VAT_SURCHARGE_ENABLED)가 꺼져 있으면 모든 판매자가 가산 대상이 아니다. */
export function isVatSurchargeEnabled(): boolean {
  return process.env.VAT_SURCHARGE_ENABLED === 'true';
}

/** 일반과세자로 확인된 판매자만 부가세를 가산한다. */
export function isVatApplicable(taxType: SellerTaxType | null): boolean {
  return isVatSurchargeEnabled() && taxType === 'general';
}

/**
 * 쿠폰 할인 후 공급가액에 판매자 과세유형을 적용한 금액 내역.
 * 무료(0원) 주문은 가산하지 않는다.
 */
export function buildOrderAmounts(
  supply: number,
  taxType: SellerTaxType | null,
): VatBreakdown & { taxTypeSnapshot: SellerTaxType | null } {
  if (supply <= 0 || !isVatApplicable(taxType)) {
    return { supply, vat: 0, total: supply, taxTypeSnapshot: null };
  }
  return { ...computeVat(supply), taxTypeSnapshot: taxType };
}
