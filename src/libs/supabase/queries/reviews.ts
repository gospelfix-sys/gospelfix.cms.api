import { createClient } from '@/libs/supabase/server';
import { createAdminClient } from '@/libs/supabase/admin';

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    email: string; // 마스킹된 값 — 원본 이메일은 이 API 밖으로 절대 나가지 않는다
  } | null;
}

// 이메일 로컬 파트 앞/뒤 2자만 남기고 가운데를 마스킹한다 (예: th*******43@naver.com).
// GET /api/v1/reviews는 인증 없이 호출 가능한 공개 엔드포인트이므로, 응답을 만들기 전
// 이 지점에서 마스킹해 원본 이메일이 네트워크로 나가지 않도록 한다.
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    // "@"가 없거나 로컬파트가 비어있는 이상값 — 마스킹 실패 시 원본을 노출하지 않고 완전히 가린다.
    return '*'.repeat(Math.max(email.length, 1));
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  const visible = 2;
  if (local.length <= visible * 2) {
    return `${local[0] ?? '*'}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }

  const head = local.slice(0, visible);
  const tail = local.slice(-visible);
  const masked = '*'.repeat(local.length - visible * 2);
  return `${head}${masked}${tail}@${domain}`;
}

/**
 * 특정 상품의 리뷰 목록을 조회한다 (reviews + profiles 앱단 조인).
 * `reviews_public_read` 정책이 공개 조회를 허용하므로 anon 클라이언트로 충분하다.
 * (원본: main/src/lib/supabase/reviews.ts의 getReviewsByProductId)
 */
export async function getReviewsByProductId(
  productId: string,
): Promise<Review[]> {
  const supabase = createClient();

  const { data: reviews, error } = await supabase
    .from('moda_reviews')
    .select('id, product_id, user_id, rating, content, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error || !reviews || reviews.length === 0) return [];

  // profiles의 RLS는 "본인 프로필만 조회 가능"이라 anon 클라이언트로는 다른 사용자(리뷰 작성자)의
  // 프로필을 읽을 수 없다. 리뷰 작성자 표시는 누구나 볼 수 있어야 하는 공개 정보이므로
  // admin 클라이언트로 조회한다(민감하지 않은 컬럼만 select).
  const userIds = (reviews as { user_id: string }[]).map((r) => r.user_id);
  const { data: profiles } = await createAdminClient()
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; email: string }) => [
      p.id,
      { ...p, email: maskEmail(p.email) },
    ]),
  );

  return (reviews as Omit<Review, 'profiles'>[]).map((r) => ({
    ...r,
    profiles: profileMap.get(r.user_id) ?? null,
  })) as Review[];
}

/**
 * 리뷰를 작성하거나(없으면 insert) 수정한다(있으면 update).
 * 작성/수정은 서버가 구매 여부를 검증한 뒤 service_role로 처리하므로 admin 클라이언트를 사용한다.
 *
 * "최초 작성인지" 판별을 위해 upsert 대신 INSERT를 먼저 시도한다: INSERT가 성공하면
 * `moda_reviews`의 `unique(product_id, user_id)` 제약 덕분에 이 호출이 확실히 최초 작성이라고
 * 단언할 수 있다(원자적). 반대로 SELECT로 먼저 존재 여부를 확인한 뒤 insert/update를
 * 분기하는 방식(TOCTOU)은, 같은 사용자가 같은 상품에 동시에 두 번 리뷰를 제출하면 두
 * 요청 모두 "최초 작성"으로 오판해 리뷰 작성 보상 쿠폰이 중복 발급될 수 있다 — INSERT가
 * unique_violation(23505)으로 실패하는 경우에만 UPDATE로 폴백해 이 레이스를 제거한다.
 */
export async function upsertReview(
  userId: string,
  productId: string,
  rating: number,
  content: string,
): Promise<{ isFirstReview: boolean }> {
  const supabase = createAdminClient();

  const { error: insertError } = await supabase
    .from('moda_reviews')
    .insert({ product_id: productId, user_id: userId, rating, content });

  if (!insertError) return { isFirstReview: true };
  if (insertError.code !== '23505') throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from('moda_reviews')
    .update({ rating, content })
    .eq('product_id', productId)
    .eq('user_id', userId);
  if (updateError) throw new Error(updateError.message);

  return { isFirstReview: false };
}
