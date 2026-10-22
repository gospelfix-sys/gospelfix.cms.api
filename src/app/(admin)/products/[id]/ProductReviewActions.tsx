'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveProductAction, rejectProductAction } from '../actions';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type { Product } from '@/types/product';

export default function ProductReviewActions({
  productId,
  status,
}: {
  productId: string;
  status: Product['status'];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'pending' && status !== 'rejected') return null;

  async function handleApprove() {
    if (pending) return;
    setPending(true);
    try {
      await approveProductAction(productId);
      router.push('/products');
    } catch {
      setError('승인 처리에 실패했습니다.');
      setPending(false);
    }
  }

  async function handleReject() {
    if (pending) return;
    setPending(true);
    try {
      await rejectProductAction(productId);
      router.push('/products');
    } catch {
      setError('반려 처리에 실패했습니다.');
      setPending(false);
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6 flex items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          className="min-h-11 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          승인
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={pending || status === 'rejected'}
          className="min-h-11 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          반려
        </button>
      </div>

      <AlertDialog
        open={error !== null}
        message={error ?? ''}
        onConfirm={() => setError(null)}
      />
    </>
  );
}
