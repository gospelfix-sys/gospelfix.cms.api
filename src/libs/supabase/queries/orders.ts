import { createAdminClient } from '@/libs/supabase/admin';
import { markCouponUsed } from '@/libs/supabase/queries/coupons';

/**
 * 이미 다른 활성 주문(pending/pending_confirm/paid)에 사용 중인 쿠폰으로 재주문을
 * 시도할 때 발생한다 (033_add_orders_coupon_active_unique_index.sql의 부분 유니크
 * 인덱스 unique_violation을 감지해서 던진다).
 */
export class CouponConflictError extends Error {
  constructor(message = '이미 사용 중인 쿠폰입니다.') {
    super(message);
    this.name = 'CouponConflictError';
  }
}

/**
 * 특정 유저가 특정 상품을 이미 결제 완료(paid)했는지 확인한다.
 * 주문 생성 시 중복 구매 방지, 리뷰/다운로드 API의 구매 검증에 재사용된다.
 * (원본: main/src/lib/supabase/orders.ts의 hasPurchasedProduct)
 */
export async function hasPurchasedProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('moda_orders')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'paid')
    .maybeSingle();

  return !!data;
}

/** 신규 주문을 pending 상태로 생성한다. */
export async function createPendingOrder(input: {
  userId: string;
  productId: string;
  orderId: string;
  amount: number;
  agreedToWithdrawalNotice: boolean;
  couponId?: string | null;
  discountAmount?: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('moda_orders').insert({
    user_id: input.userId,
    product_id: input.productId,
    order_id: input.orderId,
    amount: input.amount,
    status: 'pending',
    withdrawal_notice_agreed: input.agreedToWithdrawalNotice,
    coupon_id: input.couponId ?? null,
    discount_amount: input.discountAmount ?? 0,
  });

  if (error) {
    if (
      error.code === '23505' &&
      error.message.includes('moda_orders_coupon_id_active_unique_idx')
    ) {
      throw new CouponConflictError();
    }
    throw new Error(error.message);
  }
}

export interface OrderForPaymentNotify {
  order_id: string;
  user_id: string;
  status: string;
  amount: number;
}

/** order_id + user_id로 주문을 조회한다 (입금 알림 처리 전 상태 확인용). */
export async function getOrderByOrderIdAndUser(
  orderId: string,
  userId: string,
): Promise<OrderForPaymentNotify | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .select('order_id, user_id, status, amount')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as OrderForPaymentNotify;
}

/**
 * pending → pending_confirm 원자적 상태 전환.
 * 동시 요청으로 이미 다른 요청이 상태를 바꿨다면 false를 반환한다(호출부에서 멱등성 처리).
 */
export async function markOrderPendingConfirm(
  orderId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .update({ status: 'pending_confirm' })
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('order_id');

  if (error) throw new Error(error.message);
  return !!data && data.length > 0;
}

/**
 * 무료 주문(amount=0)을 pending → paid로 즉시 원자적 전환한다 (결제 승인 절차 자체가 없으므로
 * pending_confirm 단계와 payment_key를 모두 건너뛴다). 무료 상품은 구매 즉시 다운로드가
 * 가능해야 하므로, 관리자의 수동 입금확인을 기다리지 않고 notify-payment 호출 시점에 바로
 * paid로 전환한다.
 */
export async function markOrderPaidFree(
  orderId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .in('status', ['pending', 'pending_confirm'])
    .select('order_id, coupon_id');

  if (error) throw new Error(error.message);
  const updated = !!data && data.length > 0;
  if (updated && data[0].coupon_id) await markCouponUsed(data[0].coupon_id);
  return updated;
}

/**
 * pending 또는 pending_confirm → paid 원자적 상태 전환 (카카오페이 자동승인 콜백용).
 * 무통장입금과 달리 pending_confirm 단계를 건너뛸 수 있으므로 두 상태 모두 소스로 허용한다.
 */
export async function markOrderPaid(
  orderId: string,
  userId: string,
  paymentKey: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .update({
      status: 'paid',
      payment_key: paymentKey,
      paid_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .in('status', ['pending', 'pending_confirm'])
    .select('order_id, coupon_id');

  if (error) throw new Error(error.message);
  const updated = !!data && data.length > 0;
  if (updated && data[0].coupon_id) await markCouponUsed(data[0].coupon_id);
  return updated;
}

export interface OrderStatusOnly {
  order_id: string;
  status: string;
}

/** 여러 order_id를 한 번에 조회한다 (배치 결제 확인 전 소유권/상태 확인용). */
export async function getOrdersByOrderIdsAndUser(
  orderIds: string[],
  userId: string,
): Promise<OrderStatusOnly[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .select('order_id, status')
    .in('order_id', orderIds)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderStatusOnly[];
}

/**
 * 여러 주문을 pending → pending_confirm으로 한 번에 전환한다.
 * pending 상태인 것만 원자적으로 전환되며, 이미 pending_confirm/paid인 주문은 자연히
 * 스킵된다(멱등). 실제로 전환된 order_id 목록을 반환한다.
 */
export async function markOrdersPendingConfirm(
  orderIds: string[],
  userId: string,
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_orders')
    .update({ status: 'pending_confirm' })
    .in('order_id', orderIds)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('order_id');

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { order_id: string }) => row.order_id);
}

/**
 * 배치 주문 생성 중 일부만 성공하고 이후 항목에서 실패했을 때, 이미 생성된 pending
 * 주문들을 정리하는 보상 트랜잭션이다(insert 자체는 단일 트랜잭션이 아니므로 필요).
 */
export async function deleteOrdersByOrderIds(
  orderIds: string[],
  userId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('moda_orders')
    .delete()
    .in('order_id', orderIds)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export interface PendingOrder {
  order_id: string;
  status: 'pending' | 'pending_confirm';
  amount: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    thumbnail_url: string | null;
  } | null;
}

/**
 * 로그인 유저의 결제 대기(pending/pending_confirm) 주문 목록을 상품 정보와 함께 반환한다.
 * 무통장입금 안내(계좌번호/QR)를 마이페이지에서 다시 볼 수 있게 하기 위한 용도라
 * getPurchasedOrders와 달리 file_path는 필요 없다 (원본: getPurchasedOrders와 동일한
 * 2단계 조회 패턴).
 */
export async function getPendingOrdersForUser(
  userId: string,
): Promise<PendingOrder[]> {
  const supabase = createAdminClient();

  const { data: orders, error: ordersError } = await supabase
    .from('moda_orders')
    .select('order_id, status, amount, created_at, product_id')
    .eq('user_id', userId)
    .in('status', ['pending', 'pending_confirm'])
    .order('created_at', { ascending: false });

  if (ordersError || !orders || orders.length === 0) {
    if (ordersError)
      console.error('[getPendingOrdersForUser] orders error:', ordersError);
    return [];
  }

  const productIds = (orders as { product_id: string | null }[])
    .map((o) => o.product_id)
    .filter((id): id is string => Boolean(id));

  const { data: products, error: productsError } = await supabase
    .from('moda_products')
    .select('id, name, thumbnail_url')
    .in('id', productIds);

  if (productsError)
    console.error('[getPendingOrdersForUser] products error:', productsError);

  const productMap = new Map(
    (products ?? []).map((p: { id: string }) => [p.id, p]),
  );

  return (
    orders as {
      order_id: string;
      status: 'pending' | 'pending_confirm';
      amount: number;
      created_at: string;
      product_id: string | null;
    }[]
  ).map((order) => ({
    order_id: order.order_id,
    status: order.status,
    amount: order.amount,
    created_at: order.created_at,
    product: order.product_id
      ? (productMap.get(order.product_id) ?? null)
      : null,
  })) as PendingOrder[];
}

export interface PurchasedOrder {
  order_id: string;
  paid_at: string | null;
  amount: number;
  product: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    file_path: string | null;
  } | null;
}

/**
 * 로그인 유저의 결제 완료(paid) 주문 목록을 상품 정보와 함께 반환한다.
 * FK join 대신 2단계 조회 후 앱단에서 매핑한다 (원본: main/src/lib/supabase/orders.ts의 getPurchasedOrders).
 */
export async function getPurchasedOrders(
  userId: string,
): Promise<PurchasedOrder[]> {
  const supabase = createAdminClient();

  // 1단계: 주문 목록 조회
  const { data: orders, error: ordersError } = await supabase
    .from('moda_orders')
    .select('order_id, paid_at, amount, product_id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (ordersError || !orders || orders.length === 0) {
    if (ordersError)
      console.error('[getPurchasedOrders] orders error:', ordersError);
    return [];
  }

  // 2단계: 상품 정보 조회 (FK 설정 여부와 무관하게 동작)
  const productIds = (orders as { product_id: string | null }[])
    .map((o) => o.product_id)
    .filter((id): id is string => Boolean(id));

  const { data: products, error: productsError } = await supabase
    .from('moda_products')
    .select('id, name, thumbnail_url, file_path')
    .in('id', productIds);

  if (productsError)
    console.error('[getPurchasedOrders] products error:', productsError);

  const productMap = new Map(
    (products ?? []).map((p: { id: string }) => [p.id, p]),
  );

  return (
    orders as {
      order_id: string;
      paid_at: string | null;
      amount: number;
      product_id: string | null;
    }[]
  ).map((order) => ({
    order_id: order.order_id,
    paid_at: order.paid_at,
    amount: order.amount,
    product: order.product_id
      ? (productMap.get(order.product_id) ?? null)
      : null,
  })) as PurchasedOrder[];
}
