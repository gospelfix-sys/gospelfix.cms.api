'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export interface UseAdminRowActionsOptions<T extends { id: string }> {
  items: T[];
  reorderAction: (
    updates: { id: string; sort_order: number }[],
  ) => Promise<void>;
  duplicateAction: (id: string) => Promise<unknown>;
  deleteAction: (id: string) => Promise<void>;
}

/**
 * 관리자 목록(상품/포트폴리오/블로그/롤링배너)이 공통으로 쓰는 행 액션 상태·핸들러.
 *
 * @dnd-kit 기반 드래그 정렬(마우스·터치·키보드 모두 지원), 3점 메뉴 열림 상태,
 * 복제/삭제 진행 상태, 삭제 확인 다이얼로그 배선을 캡슐화한다. 행 레이아웃(`<table>` vs `<div>`)은
 * 파일마다 달라서 prop-getter로 감싸지 않고 개별 핸들러를 그대로 반환한다. 실제 드래그 상태(ref/
 * transform/isDragging)는 각 테이블 파일의 행 컴포넌트에서 `useSortable(id)`로 직접 받는다.
 */
export function useAdminRowActions<T extends { id: string }>({
  items,
  reorderAction,
  duplicateAction,
  deleteAction,
}: UseAdminRowActionsOptions<T>) {
  const router = useRouter();

  const [orderedItems, setOrderedItems] = useState<T[]>(items);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedItems.findIndex((item) => item.id === active.id);
    const newIndex = orderedItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = orderedItems;
    const next = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(next);
    try {
      await reorderAction(
        next.map((item, i) => ({ id: item.id, sort_order: i + 1 })),
      );
    } catch {
      setAlertMessage('순서 저장에 실패했습니다.');
      setOrderedItems(previous);
    }
  };

  const handleDuplicate = async (id: string) => {
    setMenuOpenId(null);
    setDuplicatingId(id);
    try {
      await duplicateAction(id);
      router.refresh();
    } catch {
      setAlertMessage('복사에 실패했습니다.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setMenuOpenId(null);
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    setDeletingId(pendingDeleteId);
    try {
      await deleteAction(pendingDeleteId);
      router.refresh();
    } catch {
      setAlertMessage('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const toggleMenu = (id: string) => {
    setMenuOpenId((prev) => (prev === id ? null : id));
  };

  const closeMenu = () => setMenuOpenId(null);

  const closeAlert = () => setAlertMessage(null);

  return {
    items: orderedItems,
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
  };
}
