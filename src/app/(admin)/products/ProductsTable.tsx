'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  deleteProductAction,
  updateProductsSortOrderAction,
  duplicateProductAction,
  approveProductAction,
  rejectProductAction,
} from './actions';
import { useAdminRowActions } from '@/hooks/useAdminRowActions';
import RowActionMenu from '@/components/admin/shared/RowActionMenu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { formatPrice } from '@/libs/format';
import type { Product } from '@/types/product';

const STATUS_CLASS: Record<string, string> = {
  active:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

// 판매자 셀프서비스 검수 상태 뱃지 — 관리자가 직접 등록한 상품(status='approved',
// seller_id=null)에는 굳이 노출하지 않고, 판매자 제출/반려 건에만 표시한다.
const REVIEW_STATUS_CLASS: Record<string, string> = {
  pending:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: '검수 대기',
  rejected: '반려됨',
};

function ProductRow({
  product,
  categoryLabels,
  subCategoryLabels,
  menuOpenId,
  duplicatingId,
  deletingId,
  reviewingId,
  toggleMenu,
  closeMenu,
  handleDuplicate,
  handleDeleteClick,
  handleApprove,
  handleReject,
}: {
  product: Product;
  categoryLabels: Record<string, string>;
  subCategoryLabels: Record<string, string>;
  menuOpenId: string | null;
  duplicatingId: string | null;
  deletingId: string | null;
  reviewingId: string | null;
  toggleMenu: (id: string) => void;
  closeMenu: () => void;
  handleDuplicate: (id: string) => void;
  handleDeleteClick: (id: string) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
        isDragging ? 'relative z-10 opacity-40' : ''
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="inline-flex items-center justify-center w-9 h-9 -m-2 shrink-0 touch-none cursor-grab active:cursor-grabbing rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <GripVertical size={16} className="text-gray-300 dark:text-gray-600" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
          {product.name}
        </p>
        {product.category && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {categoryLabels[product.category] ?? product.category}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {product.sub_categories.map((value) => (
            <span
              key={value}
              className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            >
              {subCategoryLabels[value] ?? value}
            </span>
          ))}
          {product.product_code && (
            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {product.product_code}
            </span>
          )}
          <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {formatPrice(product.price)}
          </span>
          <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            좋아요 {product.like_count.toLocaleString('ko-KR')}
          </span>
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_CLASS[product.is_active ? 'active' : 'inactive']
            }`}
          >
            {product.is_active ? '활성' : '비활성'}
          </span>
          {(product.status === 'pending' || product.status === 'rejected') && (
            <span
              className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_CLASS[product.status]}`}
            >
              {REVIEW_STATUS_LABEL[product.status]}
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {new Date(product.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>

        {(product.status === 'pending' || product.status === 'rejected') && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => handleApprove(product.id)}
              disabled={reviewingId !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => handleReject(product.id)}
              disabled={reviewingId !== null || product.status === 'rejected'}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              반려
            </button>
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <RowActionMenu
          open={menuOpenId === product.id}
          onToggle={() => toggleMenu(product.id)}
          onClose={closeMenu}
          editHref={`/products/${product.id}`}
          editLabel="상세보기"
          externalUrl={product.demo_url}
          onDuplicate={() => handleDuplicate(product.id)}
          duplicateDisabled={duplicatingId !== null}
          onDelete={() => handleDeleteClick(product.id)}
          deleteDisabled={deletingId !== null}
        />
      </div>
    </div>
  );
}

export default function ProductsTable({
  products,
  categoryLabels,
  subCategoryLabels,
}: {
  products: Product[];
  categoryLabels: Record<string, string>;
  subCategoryLabels: Record<string, string>;
}) {
  const router = useRouter();
  const {
    items,
    sensors,
    handleDragEnd,
    menuOpenId,
    duplicatingId,
    deletingId,
    confirmOpen,
    alertMessage,
    handleDuplicate,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    toggleMenu,
    closeMenu,
    closeAlert,
  } = useAdminRowActions({
    items: products,
    reorderAction: updateProductsSortOrderAction,
    duplicateAction: duplicateProductAction,
    deleteAction: deleteProductAction,
  });

  // 승인/반려는 다른 상품 유형(포트폴리오/블로그)과 공유하지 않는 상품 전용 개념이라
  // useAdminRowActions(공용 훅)에 넣지 않고 이 파일에서 자체적으로 상태를 관리한다.
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      await approveProductAction(id);
      router.refresh();
    } catch {
      setReviewError('승인 처리에 실패했습니다.');
    } finally {
      setReviewingId(null);
    }
  }

  async function handleReject(id: string) {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      await rejectProductAction(id);
      router.refresh();
    } catch {
      setReviewError('반려 처리에 실패했습니다.');
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <>
      {menuOpenId && <div className="fixed inset-0 z-40" onClick={closeMenu} />}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((product) => product.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                categoryLabels={categoryLabels}
                subCategoryLabels={subCategoryLabels}
                menuOpenId={menuOpenId}
                duplicatingId={duplicatingId}
                deletingId={deletingId}
                reviewingId={reviewingId}
                toggleMenu={toggleMenu}
                closeMenu={closeMenu}
                handleDuplicate={handleDuplicate}
                handleDeleteClick={handleDeleteClick}
                handleApprove={handleApprove}
                handleReject={handleReject}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      <AlertDialog
        open={alertMessage !== null}
        message={alertMessage ?? ''}
        onConfirm={closeAlert}
      />
      <AlertDialog
        open={reviewError !== null}
        message={reviewError ?? ''}
        onConfirm={() => setReviewError(null)}
      />
    </>
  );
}
