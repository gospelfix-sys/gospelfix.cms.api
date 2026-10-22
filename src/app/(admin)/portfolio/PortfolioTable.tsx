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
  deletePortfolioAction,
  updatePortfoliosSortOrderAction,
  duplicatePortfolioAction,
} from './actions';
import { useAdminRowActions } from '@/hooks/useAdminRowActions';
import RowActionMenu from '@/components/admin/shared/RowActionMenu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type { Portfolio } from '@/types/portfolio';

function PortfolioRow({
  portfolio,
  menuOpenId,
  duplicatingId,
  deletingId,
  toggleMenu,
  closeMenu,
  handleDuplicate,
  handleDeleteClick,
}: {
  portfolio: Portfolio;
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
  } = useSortable({ id: portfolio.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
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

      {portfolio.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portfolio.thumbnail_url}
          alt={portfolio.title}
          className="w-10 h-10 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide text-sm truncate">
            {portfolio.title}
          </p>
          {portfolio.is_published && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium shrink-0">
              발행
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {[
            portfolio.category,
            new Date(portfolio.created_at).toLocaleDateString('ko-KR'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="relative shrink-0">
        <RowActionMenu
          open={menuOpenId === portfolio.id}
          onToggle={() => toggleMenu(portfolio.id)}
          onClose={closeMenu}
          editHref={`/portfolio/${portfolio.id}/edit`}
          externalUrl={portfolio.site_url}
          onDuplicate={() => handleDuplicate(portfolio.id)}
          duplicateDisabled={duplicatingId !== null}
          onDelete={() => handleDeleteClick(portfolio.id)}
          deleteDisabled={deletingId !== null}
        />
      </div>
    </div>
  );
}

export default function PortfolioTable({
  portfolios,
}: {
  portfolios: Portfolio[];
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
    items: portfolios,
    reorderAction: updatePortfoliosSortOrderAction,
    duplicateAction: duplicatePortfolioAction,
    deleteAction: deletePortfolioAction,
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
            items={items.map((portfolio) => portfolio.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((portfolio) => (
              <PortfolioRow
                key={portfolio.id}
                portfolio={portfolio}
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
