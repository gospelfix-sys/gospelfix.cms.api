'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setProductAllowCouponAction } from '../actions';
import { AlertDialog } from '@/components/ui/alert-dialog';

// 쿠폰 적용 허용 여부는 판매자가 등록 화면에서 정한다. 판매자 없는 공식 상품이나 사후 조정은
// 여기서 관리자가 바꾼다(저장 즉시 반영, 재검수 대상 아님).
export default function ProductCouponToggle({
  productId,
  allowCoupon,
  isFree,
}: {
  productId: string;
  allowCoupon: boolean;
  isFree: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (pending) return;
    setPending(true);
    try {
      await setProductAllowCouponAction(productId, !allowCoupon);
      router.refresh();
    } catch {
      setError('쿠폰 적용 설정 변경에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">쿠폰 적용</dt>
      <dd className="flex items-center gap-2 text-sm">
        <span>{allowCoupon ? '허용' : '허용 안 함'}</span>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className="min-h-9 px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {allowCoupon ? '허용 해제' : '허용으로 변경'}
        </button>
        {isFree && (
          <span className="text-xs text-gray-400">
            무료 상품은 쿠폰이 적용되지 않습니다
          </span>
        )}
      </dd>
      <AlertDialog
        open={error !== null}
        message={error ?? ''}
        onConfirm={() => setError(null)}
      />
    </div>
  );
}
