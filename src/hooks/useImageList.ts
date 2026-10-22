'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export interface ImageItem {
  /** 원격 public URL 또는 아직 업로드 전인 로컬 미리보기 Object URL */
  url: string;
  /** 새로 선택한 파일. 기존에 저장돼 있던 이미지는 null */
  file: File | null;
}

export interface UseImageListOptions {
  initialUrls?: string[];
  /** 미지정 시 장수 제한 없음(PortfolioForm 동작) */
  maxImages?: number;
  maxBytes: number;
  onError: (message: string) => void;
  /**
   * - `reject-batch`: 한 장이라도 용량을 초과하면 이번 선택 전체를 거부(ProductForm/PostForm)
   * - `skip-invalid`: 용량 초과 파일만 건너뛰고 나머지는 추가(PortfolioForm)
   */
  validation: 'reject-batch' | 'skip-invalid';
}

export interface UseImageListResult {
  images: ImageItem[];
  addFiles: (fileList: FileList) => void;
  removeImage: (index: number) => void;
  /** dnd-kit DragEndEvent의 active.id / over.id(=이미지 url)를 그대로 받는다 */
  reorder: (activeUrl: string, overUrl: string) => void;
}

/**
 * 관리자 폼 3종(상품/포트폴리오/블로그)이 공통으로 쓰는 이미지 리스트 상태.
 * 파일 추가 · 제거 · dnd 재정렬과 Object URL 수명 관리를 캡슐화한다.
 */
export function useImageList({
  initialUrls,
  maxImages,
  maxBytes,
  onError,
  validation,
}: UseImageListOptions): UseImageListResult {
  const [images, setImages] = useState<ImageItem[]>(() =>
    (initialUrls ?? []).map((url) => ({ url, file: null })),
  );

  // 최신 값을 콜백에서 참조하기 위한 ref (핸들러 아이덴티티를 안정적으로 유지)
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Object URL 메모리 누수 방지: 언마운트 시 로컬 미리보기 전부 revoke
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => {
        if (img.file) URL.revokeObjectURL(img.url);
      });
    };
  }, []);

  const addFiles = useCallback(
    (fileList: FileList) => {
      const maxMb = Math.round(maxBytes / 1024 / 1024);
      let candidates = Array.from(fileList);
      if (candidates.length === 0) return;

      if (maxImages !== undefined) {
        const remaining = maxImages - imagesRef.current.length;
        if (remaining <= 0) {
          onErrorRef.current(
            `이미지는 최대 ${maxImages}장까지 등록할 수 있습니다.`,
          );
          return;
        }
        candidates = candidates.slice(0, remaining);
      }

      if (validation === 'reject-batch') {
        if (candidates.some((file) => file.size > maxBytes)) {
          onErrorRef.current(
            `이미지는 ${maxMb}MB 이하 파일만 업로드할 수 있습니다.`,
          );
          return;
        }
      } else {
        candidates = candidates.filter((file) => {
          if (file.size > maxBytes) {
            onErrorRef.current(
              `${file.name}: 이미지는 ${maxMb}MB 이하만 업로드할 수 있습니다.`,
            );
            return false;
          }
          return true;
        });
        if (candidates.length === 0) return;
      }

      const added = candidates.map((file) => ({
        url: URL.createObjectURL(file),
        file,
      }));
      setImages((prev) => [...prev, ...added]);
    },
    [maxBytes, maxImages, validation],
  );

  const removeImage = useCallback((index: number) => {
    const target = imagesRef.current[index];
    if (target?.file) URL.revokeObjectURL(target.url);
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reorder = useCallback((activeUrl: string, overUrl: string) => {
    if (activeUrl === overUrl) return;
    setImages((prev) => {
      const oldIndex = prev.findIndex((img) => img.url === activeUrl);
      const newIndex = prev.findIndex((img) => img.url === overUrl);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  return { images, addFiles, removeImage, reorder };
}
