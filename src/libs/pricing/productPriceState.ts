export interface ProductPriceInput {
  price: number;
  supply_price: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
}

/**
 * 요청 시점 기준 실제 판매가(결제 금액)를 계산한다.
 * gospelfix(main 앱) src/lib/discount.ts의 getProductPriceState()와 동일한 5분기 로직을
 * 서버 측(주문 생성 시 결제 금액 재검증용)에 미러링한다 — 두 저장소가 각자 계산해도 항상
 * 같은 결과가 나와야 클라이언트가 보여준 가격과 실제 결제 금액이 어긋나지 않는다.
 *
 * price(판매 가격)=할인가, supply_price(공급원가)=정가로 재활용한다. 할인 기간을 설정하지
 * 않으면(discount_starts_at/ends_at 둘 다 NULL) price가 항상 적용된다.
 */
export function getEffectivePrice(product: ProductPriceInput): number {
  if (product.price === 0) return 0;

  const hasWindow =
    product.discount_starts_at != null || product.discount_ends_at != null;
  if (!hasWindow) return product.price;

  // 기간을 설정했는데 정가로 쓸 supply_price가 없거나 0 이하면 복귀 대상이 없어 기간 로직을
  // 적용할 수 없음 — 안전하게 price를 상시 적용(gospelfix discount.ts와 동일한 폴백)
  if (product.supply_price == null || product.supply_price <= 0) return product.price;

  const now = Date.now();
  const started =
    product.discount_starts_at == null ||
    now >= new Date(product.discount_starts_at).getTime();
  const notEnded =
    product.discount_ends_at == null ||
    now < new Date(product.discount_ends_at).getTime();

  return started && notEnded ? product.price : product.supply_price;
}
