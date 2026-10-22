import { createAdminClient } from '@/libs/supabase/admin';

export interface ProductLikeStatus {
  likeCount: number;
  likedByMe: boolean;
}

export interface ProductLikeToggleResult {
  likeCount: number;
  liked: boolean;
}

// moda_products.like_count는 moda_product_likes insert/delete 트리거(sync_product_like_count)로
// 항상 최신 상태로 유지되므로, 카운트 조회는 moda_product_likes를 직접 세지 않고 이 컬럼만 읽는다.
async function getLikeCount(productId: string): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select('like_count')
    .eq('id', productId)
    .single();

  if (error || !data) return null;
  return (data as { like_count: number }).like_count;
}

/**
 * 좋아요 수와, (로그인한 경우) 현재 사용자의 좋아요 여부를 함께 조회한다.
 * userId가 null이면 미로그인 상태이므로 likedByMe는 항상 false.
 */
export async function getLikeStatus(
  productId: string,
  userId: string | null,
): Promise<ProductLikeStatus | null> {
  const likeCount = await getLikeCount(productId);
  if (likeCount === null) return null;

  if (!userId) return { likeCount, likedByMe: false };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('moda_product_likes')
    .select('id')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .maybeSingle();

  return { likeCount, likedByMe: Boolean(data) };
}

/**
 * 좋아요를 토글한다 — 이미 좋아요한 상태면 취소(delete), 아니면 추가(insert).
 * `unique(product_id, user_id)` 제약이 중복 좋아요를 막아주므로, 이 함수는 존재 여부를
 * 먼저 확인한 뒤 insert/delete 중 하나만 수행한다(insert 실패 후 재시도하는 방식이 아님).
 * 카운트는 DB 트리거(sync_product_like_count)가 원자적으로 갱신하므로, 이 함수는
 * insert/delete 이후 products.like_count를 다시 읽기만 한다.
 *
 * 동시성: "존재 확인 → insert" 사이에 레이스가 있어 더블클릭·재시도 등으로 두 요청이
 * 거의 동시에 도착하면 두 번째 insert가 unique(product_id, user_id) 위반(23505)으로
 * 실패할 수 있다. 이는 실제 오류가 아니라 "이미 좋아요한 상태"와 동일한 결과이므로,
 * 에러를 던지는 대신 liked: true로 정상 응답한다(idempotent). delete 쪽은 두 번째
 * 호출이 0 rows affected로 조용히 끝나고 트리거도 실행되지 않아 이중 차감 위험이 없다.
 */
export async function toggleLike(
  productId: string,
  userId: string,
): Promise<ProductLikeToggleResult | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('moda_product_likes')
    .select('id')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .maybeSingle();

  let liked = !existing;

  if (existing) {
    const { error } = await supabase
      .from('moda_product_likes')
      .delete()
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('moda_product_likes')
      .insert({ product_id: productId, user_id: userId });
    if (error && error.code !== '23505') throw new Error(error.message);
    // 23505(unique violation)는 동시 요청으로 이미 좋아요가 반영된 것 — liked: true로 취급
    liked = true;
  }

  const likeCount = await getLikeCount(productId);
  if (likeCount === null) return null;

  return { likeCount, liked };
}
