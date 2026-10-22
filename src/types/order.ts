// 관리자 "주문 관리" 목록 1건 — orders + products + profiles 조인 결과
export interface AdminOrderListItem {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'pending_confirm' | 'paid' | 'cancelled';
  payment_key: string | null;
  paid_at: string | null;
  created_at: string;
  product: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    email: string;
  } | null;
}
