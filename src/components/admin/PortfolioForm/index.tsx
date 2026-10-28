'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile } from '@/libs/supabase/queries/uploadFile';
import { useImageList } from '@/hooks/useImageList';
import SortableImageGrid from '@/components/admin/shared/SortableImageGrid';
import RichEditor from '@/components/admin/RichEditor';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Dropdown } from '@/components/ui/dropdown';
import type { PortfolioFormInput } from '@/types/portfolio';

const CATEGORIES = [
  '쇼핑몰 · 이커머스',
  '음악 · 신문사',
  '브랜딩 · 디자인',
  '랜딩 페이지',
  '포트폴리오',
  '기타',
];

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm';

const CHECKBOX_CLASS =
  'w-4 h-4 rounded border-gray-300 accent-black dark:accent-white focus:ring-black dark:focus:ring-white';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

interface PortfolioFormProps {
  initialValues?: Partial<PortfolioFormInput>;
  onSubmit: (input: PortfolioFormInput) => Promise<void>;
  submitLabel?: string;
}

export default function PortfolioForm({
  initialValues,
  onSubmit,
  submitLabel = '등록',
}: PortfolioFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [tagsInput, setTagsInput] = useState(
    (initialValues?.tags ?? []).join(', '),
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [siteUrl, setSiteUrl] = useState(initialValues?.site_url ?? '');
  const [isPublished, setIsPublished] = useState(
    initialValues?.is_published ?? false,
  );
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const {
    images,
    addFiles: handleFilesSelect,
    removeImage,
    reorder: reorderImages,
  } = useImageList({
    initialUrls: initialValues?.images,
    maxBytes: IMAGE_MAX_BYTES,
    onError: setAlertMessage,
    validation: 'skip-invalid',
  });

  const handleSave = async () => {
    if (loading) return;
    if (!title.trim()) {
      setAlertMessage('브랜드명을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const allImages = await Promise.all(
        images.map(async (img) => {
          if (!img.file) return img.url;
          const { publicUrl } = await uploadFile(img.file, 'portfolio-images');
          return publicUrl;
        }),
      );
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit({
        title: title.trim(),
        category,
        tags,
        thumbnail_url: allImages[0] ?? '',
        images: allImages,
        description,
        site_url: siteUrl,
        is_published: isPublished,
      });
    } catch (err) {
      setAlertMessage(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-stretch max-w-7xl w-full">
        {/* 모바일 전용 액션 바: 헤더(h-14) 바로 아래 sticky로 고정해 폼이 길어져도 저장 버튼에 항상 접근 가능 */}
        <div className="lg:hidden sticky top-14 z-20 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <label
              htmlFor="isPublished-mobile"
              className="flex items-center gap-2 cursor-pointer mr-auto"
            >
              <input
                id="isPublished-mobile"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                발행 (프론트에 노출)
              </span>
            </label>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? '저장 중...' : submitLabel}
            </button>
          </div>
        </div>

        {/* 메인 폼 카드 */}
        <div className="w-full lg:flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="space-y-5">
            {/* 브랜드명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                브랜드명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="브랜드명을 입력하세요"
                className={INPUT_CLASS}
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                카테고리
              </label>
              <Dropdown
                options={CATEGORIES}
                value={category}
                onChange={setCategory}
                placeholder="카테고리 선택"
              />
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                태그 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="예: 쇼핑몰, 이커머스, Next.js"
                className={INPUT_CLASS}
              />
            </div>

            {/* 이미지 업로드 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  썸네일 대표 이미지
                </label>
                <span className="text-xs text-gray-400">
                  1080 × 1350px 권장
                </span>
              </div>

              <SortableImageGrid
                images={images}
                onReorder={reorderImages}
                onRemove={removeImage}
                onAddFiles={handleFilesSelect}
                helperText="JPG, PNG, WebP, AVIF · 최대 10MB · 다중 선택 가능"
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                설명
              </label>
              <RichEditor value={description} onChange={setDescription} />
            </div>
          </div>
        </div>

        {/* 우측 액션 패널 (데스크탑 전용) */}
        <div className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full px-4 py-2.5 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? '저장 중...' : submitLabel}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <label
              htmlFor="isPublished-desktop"
              className="flex items-center gap-2.5 cursor-pointer pt-3 mt-1 border-t border-gray-100 dark:border-gray-700"
            >
              <input
                id="isPublished-desktop"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                발행 (프론트에 노출)
              </span>
            </label>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!alertMessage}
        message={alertMessage}
        onConfirm={() => setAlertMessage('')}
      />
    </>
  );
}
