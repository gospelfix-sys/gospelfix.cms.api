'use client';

import { GripVertical } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  deleteReferralBannerAction,
  updateReferralBannersSortOrderAction,
  duplicateReferralBannerAction,
} from './actions';
import { useAdminRowActions } from '@/hooks/useAdminRowActions';
import RowActionMenu from '@/components/admin/shared/RowActionMenu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type {
  BannerType,
  ReferralBanner,
} from '@/libs/supabase/queries/referral-banners.admin';

const STATUS_CLASS: Record<string, string> = {
  active:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  visible: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const BANNER_TYPE_LABEL: Record<BannerType, string> = {
  referral: '추천인',
  review: '리뷰',
  signup: '가입',
  general: '일반',
};

const BANNER_TYPE_BADGE_CLASS: Record<BannerType, string> = {
  referral:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  review:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  signup: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  general: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function BannerRow({
  banner,
  menuOpenId,
  duplicatingId,
  deletingId,
  toggleMenu,
  closeMenu,
  handleDuplicate,
  handleDeleteClick,
}: {
  banner: ReferralBanner;
  menuOpenId: string | null;
  duplicatingId: string | null;
  deletingId: string | null;
  toggleMenu: (id: string) => void;
  closeMenu: () => void;
  handleDuplicate: (id: string) => void;
  handleDeleteClick: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

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
          {banner.message}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${BANNER_TYPE_BADGE_CLASS[banner.banner_type]}`}
          >
            {BANNER_TYPE_LABEL[banner.banner_type]}
          </span>
          <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            할인율 {banner.discount_rate}%
          </span>
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_CLASS[
                banner.show_referral_actions ? 'visible' : 'inactive'
              ]
            }`}
          >
            코드·버튼 {banner.show_referral_actions ? '표시' : '숨김'}
          </span>
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_CLASS[banner.is_enabled ? 'active' : 'inactive']
            }`}
          >
            {banner.is_enabled ? '활성' : '비활성'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {new Date(banner.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>

      <div className="relative shrink-0">
        <RowActionMenu
          open={menuOpenId === banner.id}
          onToggle={() => toggleMenu(banner.id)}
          onClose={closeMenu}
          editHref={`/referral-banners/${banner.id}/edit`}
          onDuplicate={() => handleDuplicate(banner.id)}
          duplicateDisabled={duplicatingId !== null}
          onDelete={() => handleDeleteClick(banner.id)}
          deleteDisabled={deletingId !== null}
        />
      </div>
    </div>
  );
}

export default function ReferralBannersTable({
  banners,
}: {
  banners: ReferralBanner[];
}) {
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
    items: banners,
    reorderAction: updateReferralBannersSortOrderAction,
    duplicateAction: duplicateReferralBannerAction,
    deleteAction: deleteReferralBannerAction,
  });

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
            items={items.map((banner) => banner.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((banner) => (
              <BannerRow
                key={banner.id}
                banner={banner}
                menuOpenId={menuOpenId}
                duplicatingId={duplicatingId}
                deletingId={deletingId}
                toggleMenu={toggleMenu}
                closeMenu={closeMenu}
                handleDuplicate={handleDuplicate}
                handleDeleteClick={handleDeleteClick}
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
    </>
  );
}
