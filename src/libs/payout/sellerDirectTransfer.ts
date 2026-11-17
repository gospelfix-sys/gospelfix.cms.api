// 구매자가 판매자 계좌로 직접 입금하는 방식의 기능 플래그.
// 약관·처리방침 개정 공지와 법률 검토가 끝나기 전에는 꺼 둔다(기본 꺼짐).
export function isSellerDirectTransferEnabled(): boolean {
  return process.env.SELLER_DIRECT_TRANSFER_ENABLED === 'true';
}

// 플래그가 꺼진 동안은 회사 계좌도 없으므로 유료 주문을 만들면 입금할 곳이 없다 → 주문 생성 단계에서 막는다
export const DIRECT_TRANSFER_PREPARING_MESSAGE =
  '계좌이체 결제를 준비 중입니다. 잠시 후 다시 이용해주세요.';
export const SELLER_ACCOUNT_REQUIRED_MESSAGE =
  '판매자가 아직 입금 계좌를 등록하지 않아 지금은 구매할 수 없습니다.';
export const MIXED_SELLER_MESSAGE =
  '판매자가 다른 상품은 함께 결제할 수 없습니다. 판매자별로 나누어 주문해주세요.';
