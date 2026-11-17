// 판매자 직접 입금 방식(구매자가 판매자 계좌로 입금)을 열지 말지 정하는 스위치.
// 환경변수 SELLER_DIRECT_TRANSFER_ENABLED가 정확히 'true'일 때만 켜진다(기본 꺼짐).
// - 꺼짐: 유료 주문 생성이 "준비 중" 409로 막힌다. 무료 주문은 영향 없다.
// - 켜짐: 유료 주문을 받고, 판매자가 동의한 계좌를 주문한 구매자에게만 보여준다.
// 약관·처리방침 개정 고지와 법률 검토가 끝나기 전에는 꺼 둔다.
// Vercel은 값을 바꾼 뒤 재배포해야 반영된다.
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
