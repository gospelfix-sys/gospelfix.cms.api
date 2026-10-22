import { createAdminClient } from '@/libs/supabase/admin';

// 이 파일은 (1) 주문 생성 시 결제 금액 서버 재검증, (2) 구매 후 다운로드 파일 접근 검증
// 두 용도로 상품을 조회하는 쿼리를 모은다 — 둘 다 "일반 공개 API로는 노출하면 안 되는 필드를
// 신뢰된 서버 로직에서만 조회한다"는 공통점이 있다.

export interface ActiveProduct {
  id: string;
  price: number;
  supply_price: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  is_active: boolean;
}

/**
 * 활성(is_active) 상품을 id로 조회한다.
 * 주문 생성 시 클라이언트가 보낸 금액을 서버에서 재검증하는 용도로 사용한다.
 * supply_price/discount_starts_at/discount_ends_at도 함께 조회해야
 * getEffectivePrice()가 할인 기간 종료 여부를 반영한 실제 판매가를 계산할 수 있다.
 */
export async function getActiveProductById(
  productId: string,
): Promise<ActiveProduct | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(
      'id, price, supply_price, discount_starts_at, discount_ends_at, is_active',
    )
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as ActiveProduct;
}

export interface ProductFileInfo {
  file_path: string | null;
  name: string;
}

/**
 * 구매 후 다운로드 파일 접근 검증용으로 상품을 id로 조회한다.
 * is_active 필터를 걸지 않는다 — 관리자가 후에 상품을 비활성화(판매 중지)해도, 이미 구매한
 * 유저는 계속 다운로드할 수 있어야 하기 때문(구매 시점에 이미 산 것이므로 사후 비활성화가
 * 접근권을 뺏지 않는다).
 */
export async function getProductFileInfo(
  productId: string,
): Promise<ProductFileInfo | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select('file_path, name')
    .eq('id', productId)
    .single();

  if (error || !data) return null;
  return data as ProductFileInfo;
}
