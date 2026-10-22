'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { AdminOrderListItem } from '@/types/order';
import { confirmOrderPaymentAction } from './actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';

const STATUS_LABEL: Record<AdminOrderListItem['status'], string> = {
  pending: '주문접수',
  pending_confirm: '입금확인중',
  paid: '결제완료',
  cancelled: '취소됨',
};

const STATUS_CLASS: Record<AdminOrderListItem['status'], string> = {
  pending: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  pending_confirm:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400',
};

function formatPrice(amount: number): string {
  return amount === 0 ? '무료' : amount.toLocaleString('ko-KR') + '원';
}

export default function OrdersTable({
  orders,
}: {
  orders: AdminOrderListItem[];
}) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const handleConfirmClick = (id: string) => {
    setPendingConfirmId(id);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingConfirmId) return;
    const id = pendingConfirmId;
    setPendingConfirmId(null);
    setConfirmingId(id);
    try {
      await confirmOrderPaymentAction(id);
      router.refresh();
    } catch {
      setAlertMessage('입금 확인 처리에 실패했습니다.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <ConfirmDialog
        open={!!pendingConfirmId}
        title="입금을 확인하셨습니까?"
        description="주문 상태가 결제완료로 즉시 전환되며 되돌릴 수 없습니다."
        confirmLabel="확인"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingConfirmId(null)}
      />
      <AlertDialog
        open={!!alertMessage}
        message={alertMessage ?? ''}
        onConfirm={() => setAlertMessage(null)}
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
              주문번호
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
              상품
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">
              구매자
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-28">
              금액
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-40">
              상태
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-28 hidden sm:table-cell">
              결제일
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-28 hidden sm:table-cell">
              주문일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {orders.map((order) => (
            <tr
              key={order.id}
              className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 ${
                confirmingId === order.id ? 'opacity-40' : ''
              }`}
            >
              <td
                className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 truncate max-w-[10rem]"
                title={order.order_id}
              >
                {order.order_id}
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-gray-100 truncate max-w-xs">
                {order.product?.name ?? '(삭제된 상품)'}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                {order.user?.email ?? '(탈퇴한 회원)'}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {formatPrice(order.amount)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CLASS[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                  {order.status === 'pending_confirm' && (
                    <button
                      onClick={() => handleConfirmClick(order.id)}
                      disabled={confirmingId === order.id}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      <Check size={12} />
                      확인
                    </button>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                {order.paid_at
                  ? new Date(order.paid_at).toLocaleDateString('ko-KR')
                  : '-'}
              </td>
              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                {new Date(order.created_at).toLocaleDateString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
