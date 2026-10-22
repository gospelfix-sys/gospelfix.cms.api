'use client';

import Link from 'next/link';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { MoreVertical, Pencil, Trash2, ExternalLink, Copy } from 'lucide-react';

export interface RowActionMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** 없으면 "상세 편집" 메뉴 항목 자체가 렌더링되지 않는다 */
  editHref?: string;
  /** editHref 메뉴 항목의 표시 텍스트 (기본값 "상세 편집") — 폼이 아니라 읽기 전용 상세/검수
   * 페이지로 연결하는 경우(예: 상품 승인/반려) "상세보기"처럼 다르게 표현할 때 사용 */
  editLabel?: string;
  /** 없으면 "새 탭에서 열기"가 비활성화된다 */
  externalUrl?: string | null;
  onDuplicate: () => void;
  duplicateDisabled?: boolean;
  onDelete: () => void;
  deleteDisabled?: boolean;
}

const ITEM_CLASS =
  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * 관리자 목록 행의 "..." 액션 메뉴(상세 편집 / 새 탭에서 열기 / 복사 / 삭제).
 * 상태 배지처럼 도메인마다 다른 표현은 각 테이블 파일에 남긴다.
 */
export default function RowActionMenu({
  open,
  onToggle,
  onClose,
  editHref,
  editLabel,
  externalUrl,
  onDuplicate,
  duplicateDisabled,
  onDelete,
  deleteDisabled,
}: RowActionMenuProps) {
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onToggle() : onClose())}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          aria-label="더보기 메뉴"
          className="min-h-11 min-w-11 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <MoreVertical size={16} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
          className="w-44 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 py-1"
        >
          {editHref && (
            <Link
              href={editHref}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Pencil size={14} className="text-gray-400 shrink-0" />
              {editLabel ?? '상세 편집'}
            </Link>
          )}
          <button
            onClick={() => {
              if (externalUrl)
                window.open(externalUrl, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            disabled={!externalUrl}
            className={ITEM_CLASS}
          >
            <ExternalLink size={14} className="text-gray-400 shrink-0" />새
            탭에서 열기
          </button>
          <button
            onClick={onDuplicate}
            disabled={duplicateDisabled}
            className={ITEM_CLASS}
          >
            <Copy size={14} className="text-gray-400 shrink-0" />
            복사
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button
            onClick={onDelete}
            disabled={deleteDisabled}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} className="shrink-0" />
            삭제
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
