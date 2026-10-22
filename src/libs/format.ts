export function formatPrice(amount: number | null): string {
  if (amount === null) return '-';
  return amount === 0 ? '무료' : amount.toLocaleString('ko-KR') + '원';
}

// 사용자가 자유 입력한 값을 그대로 href에 연결하는 관리자 상세 페이지(견적 신청,
// 상품 검수 등)에서 공통으로 쓰는 URL 검증 헬퍼. javascript: 등 위험한 스킴이
// 그대로 외부 링크로 렌더링되지 않도록 http/https만 허용한다.
export function isSafeHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
