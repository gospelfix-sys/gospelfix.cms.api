'use client';

import { useRef } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ImageItem } from '@/hooks/useImageList';

export interface SortableImageGridProps {
  images: ImageItem[];
  onReorder: (activeUrl: string, overUrl: string) => void;
  onRemove: (index: number) => void;
  onAddFiles: (files: FileList) => void;
  /** 미지정 시 장수 제한 없음 — 추가 버튼이 항상 노출된다 */
  maxImages?: number;
  helperText: string;
  addButtonLabel?: string;
  className?: string;
  /** 카드 비율 Tailwind 클래스 (리터럴로 전달해야 JIT가 감지한다). 기본 4:5 */
  aspectClassName?: string;
}

function SortableImageCard({
  img,
  index,
  onRemove,
  aspectClassName,
}: {
  img: ImageItem;
  index: number;
  onRemove: (index: number) => void;
  aspectClassName: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative ${aspectClassName} rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? 'opacity-40 z-10' : ''
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={`이미지 ${index + 1}`}
        className="w-full h-full object-cover"
      />
      {index === 0 && (
        <span className="absolute top-2 left-2 px-2 py-1 text-xs font-medium bg-black/80 text-white rounded-md">
          대표
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * 드래그로 순서를 바꿀 수 있는 이미지 업로드 그리드.
 * 상태는 `useImageList` 훅이 갖고, 이 컴포넌트는 표현과 dnd 배선만 담당한다.
 */
export default function SortableImageGrid({
  images,
  onReorder,
  onRemove,
  onAddFiles,
  maxImages,
  helperText,
  addButtonLabel = '이미지 추가',
  className,
  aspectClassName = 'aspect-[4/5]',
}: SortableImageGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  const canAdd = maxImages === undefined || images.length < maxImages;

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={images.map((img) => img.url)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img, index) => (
              <SortableImageCard
                key={img.url}
                img={img}
                index={index}
                onRemove={onRemove}
                aspectClassName={aspectClassName}
              />
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`${aspectClassName} rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-500 transition-colors`}
              >
                <Plus size={24} />
                <span className="text-xs">{addButtonLabel}</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-gray-400 mt-2">{helperText}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAddFiles(e.target.files);
          }
          // 같은 파일을 연속으로 선택해도 change가 발생하도록 초기화
          e.target.value = '';
        }}
      />
    </div>
  );
}
