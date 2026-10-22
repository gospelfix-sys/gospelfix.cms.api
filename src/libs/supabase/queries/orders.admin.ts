import { createAdminClient } from '@/libs/supabase/admin';
import { markCouponUsed } from '@/libs/supabase/queries/coupons';
import type { AdminOrderListItem } from '@/types/order';

// PostgREST .or() 필터 문자열에서 값을 안전하게 감싼다 — 검색어에 콤마/괄호가 섞여도
// or() 조건 파싱이 깨지지 않도록 큰따옴표로 감싸고 내부 큰따옴표만 이스케이프한다.
function escapeForOrFilter(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export interface AdminOrderFilters {
  search?: string;
  // 'YYYY-MM-DD' 형식 (날짜 input의 value 그대로). to는 해당 날짜 23:59:59.999까지 포함한다.
  orderDateFrom?: string;
  orderDateTo?: string;
  paidDateFrom?: string;
  paidDateTo?: string;
}

function endOfDay(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999`;
}

/**
 * 관리자 "주문 관리" 목록을 페이지네이션으로 반환한다.
 * FK join 대신 2단계 조회 후 앱단에서 매핑한다(getPurchasedOrders와 동일한 관례).
 * orders는 구매가 발생할 때마다 계속 쌓이는 트랜잭션 데이터라 DB 레벨(.range())로 페이지네이션한다.
 * search가 주어지면 주문번호(order_id) 부분일치 + 상품명/구매자 이메일이 일치하는
 * product_id/user_id로 필터링한다. 날짜 필터는 주문일(created_at)/결제일(paid_at) 각각
 * 독립적으로 범위 지정 가능하다 — paid_at 필터를 걸면 아직 결제 안 된 주문(paid_at=null)은
 * 자연히 제외된다. 전부 DB 레벨 필터라 .range() 페이지네이션이 그대로 맞는다.
 */
export async function getAllOrdersAdmin(
  page: number,
  limit: number,
  filters?: AdminOrderFilters,
): Promise<{ data: AdminOrderListItem[]; total: number }> {
  const supabase = createAdminClient();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('moda_orders')
    .select(
      'id, order_id, amount, status, payment_key, paid_at, created_at, product_id, user_id',
      { count: 'exact' },
    );

  const trimmedSearch = filters?.search?.trim();
  if (trimmedSearch) {
    const [{ data: matchedProducts }, { data: matchedProfiles }] =
      await Promise.all([
        supabase
          .from('moda_products')
          .select('id')
          .ilike('name', `%${trimmedSearch}%`),
        supabase
          .from('profiles')
          .select('id')
          .ilike('email', `%${trimmedSearch}%`),
      ]);
    const productIds = (matchedProducts ?? []).map((p: { id: string }) => p.id);
    const userIds = (matchedProfiles ?? []).map((u: { id: string }) => u.id);

    const orConditions = [
      `order_id.ilike.${escapeForOrFilter(`%${trimmedSearch}%`)}`,
    ];
    if (productIds.length > 0)
      orConditions.push(`product_id.in.(${productIds.join(',')})`);
    if (userIds.length > 0)
      orConditions.push(`user_id.in.(${userIds.join(',')})`);

    query = query.or(orConditions.join(','));
  }

  if (filters?.orderDateFrom)
    query = query.gte('created_at', filters.orderDateFrom);
  if (filters?.orderDateTo)
    query = query.lte('created_at', endOfDay(filters.orderDateTo));
  if (filters?.paidDateFrom) query = query.gte('paid_at', filters.paidDateFrom);
  if (filters?.paidDateTo)
    query = query.lte('paid_at', endOfDay(filters.paidDateTo));

  const {
    data: orders,
    error,
    count,
  } = await query.order('created_at', { ascending: false }).range(from, to);

  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) return { data: [], total: count ?? 0 };

  type OrderRow = {
    id: string;
    order_id: string;
    amount: number;
    status: string;
    payment_key: string | null;
    paid_at: string | null;
    created_at: string;
    product_id: string | null;
    user_id: string | null;
  };
  const rows = orders as OrderRow[];

  const productIds = [
    ...new Set(
      rows.map((o) => o.product_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const userIds = [
    ...new Set(
      rows.map((o) => o.user_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: products }, { data: profiles }] = await Promise.all([
    productIds.length > 0
      ? supabase.from('moda_products').select('id, name').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length > 0
      ? supabase.from('profiles').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
  ]);

  const productMap = new Map(
    (products ?? []).map((p: { id: string; name: string }) => [p.id, p]),
  );
  const userMap = new Map(
    (profiles ?? []).map((u: { id: string; email: string }) => [u.id, u]),
  );

  return {
    data: rows.map((o) => ({
      id: o.id,
      order_id: o.order_id,
      amount: o.amount,
      status: o.status as AdminOrderListItem['status'],
      payment_key: o.payment_key,
      paid_at: o.paid_at,
      created_at: o.created_at,
      product: o.product_id ? (productMap.get(o.product_id) ?? null) : null,
      user: o.user_id ? (userMap.get(o.user_id) ?? null) : null,
    })),
    total: count ?? 0,
  };
}

/**
 * 관리자가 무통장입금 확인 후 pending_confirm → paid로 원자적 전환한다.
 * WHERE절에 status 조건을 실어 보내 이미 처리된 주문의 중복 확정을 방지한다.
 */
export async function confirmOrderPaymentAdmin(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending_confirm')
    .select('id, coupon_id');

  if (error) throw new Error(error.message);
  const updated = !!data && data.length > 0;
  if (updated && data[0].coupon_id) await markCouponUsed(data[0].coupon_id);
  return updated;
}
