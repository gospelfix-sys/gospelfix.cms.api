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
  deletePostAction,
  updatePostsSortOrderAction,
  duplicatePostAction,
} from './actions';
import { useAdminRowActions } from '@/hooks/useAdminRowActions';
import RowActionMenu from '@/components/admin/shared/RowActionMenu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type { Post } from '@/types/post';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? '';

const STATUS_LABEL: Record<string, string> = {
  published: '발행됨',
  draft: '초안',
};

const STATUS_CLASS: Record<string, string> = {
  published:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function PostRow({
  post,
  menuOpenId,
  duplicatingId,
  deletingId,
  toggleMenu,
  closeMenu,
  handleDuplicate,
  handleDeleteClick,
}: {
  post: Post;
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
  } = useSortable({ id: post.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const publicUrl = SITE_URL ? `${SITE_URL}/blog/${post.slug}` : '';

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
          {post.title}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {post.category && (
            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {post.category}
            </span>
          )}
          <span
            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[post.status]}`}
          >
            {STATUS_LABEL[post.status]}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {new Date(post.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>

      <div className="relative shrink-0">
        <RowActionMenu
          open={menuOpenId === post.id}
          onToggle={() => toggleMenu(post.id)}
          onClose={closeMenu}
          editHref={`/blog/${post.id}/edit`}
          externalUrl={publicUrl}
          onDuplicate={() => handleDuplicate(post.id)}
          duplicateDisabled={duplicatingId !== null}
          onDelete={() => handleDeleteClick(post.id)}
          deleteDisabled={deletingId !== null}
        />
      </div>
    </div>
  );
}

export default function BlogTable({ posts }: { posts: Post[] }) {
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
    items: posts,
    reorderAction: updatePostsSortOrderAction,
    duplicateAction: duplicatePostAction,
    deleteAction: deletePostAction,
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
            items={items.map((post) => post.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((post) => (
              <PostRow
                key={post.id}
                post={post}
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
