'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile } from '@/libs/supabase/queries/uploadFile';
import { slugify } from '@/libs/utils';
import { useImageList } from '@/hooks/useImageList';
import SortableImageGrid from '@/components/admin/shared/SortableImageGrid';
import RichEditor from '@/components/admin/RichEditor';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Dropdown } from '@/components/ui/dropdown';
import type { PostCategory, PostFormInput, PostStatus } from '@/types/post';

interface PostFormProps {
  initialValues?: Partial<PostFormInput>;
  onSubmit: (input: PostFormInput, status: PostStatus) => Promise<void>;
  submitLabel?: string;
}

// 실제 운영 news 테이블의 category CHECK 제약과 동일한 고정값
const CATEGORY_OPTIONS: PostCategory[] = [
  '신규 템플릿',
  '이벤트',
  'AI 활용',
  'UX/UI 디자인',
];
const DEFAULT_CATEGORY: PostCategory = '신규 템플릿';

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm';

const PUBLISHED_LABEL = '발행 (프론트에 노출)';
const CHECKBOX_CLASS =
  'w-4 h-4 rounded border-gray-300 accent-black dark:accent-white focus:ring-black dark:focus:ring-white';

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

export default function PostForm({
  initialValues,
  onSubmit,
  submitLabel = '저장',
}: PostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const [category, setCategory] = useState<PostCategory>(
    initialValues?.category ?? DEFAULT_CATEGORY,
  );
  const [isPublished, setIsPublished] = useState(
    initialValues?.status === 'published',
  );
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // 커버(대표) 이미지 — 첫 번째 이미지만 cover_image_url로 저장한다.
  const {
    images,
    addFiles: handleImagesSelect,
    removeImage,
    reorder: reorderImages,
  } = useImageList({
    initialUrls: initialValues?.cover_image_url
      ? [initialValues.cover_image_url]
      : [],
    maxImages: MAX_IMAGES,
    maxBytes: IMAGE_MAX_BYTES,
    onError: setAlertMessage,
    validation: 'reject-batch',
  });

  // 갤러리 사진
  const {
    images: portfolioImages,
    addFiles: handlePortfolioImagesSelect,
    removeImage: removePortfolioImage,
    reorder: reorderPortfolioImages,
  } = useImageList({
    initialUrls: initialValues?.portfolio_images,
    maxImages: MAX_IMAGES,
    maxBytes: IMAGE_MAX_BYTES,
    onError: setAlertMessage,
    validation: 'reject-batch',
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!initialValues?.slug) setSlug(slugify(value));
  };

  const handleSave = async () => {
    if (loading) return;
    if (!title.trim()) {
      setAlertMessage('제목을 입력해주세요.');
      return;
    }
    if (!slug.trim()) {
      setAlertMessage('슬러그를 입력해주세요.');
      return;
    }
    const status: PostStatus = isPublished ? 'published' : 'draft';
    setLoading(true);
    try {
      // 대표(첫 번째) 이미지만 커버 이미지로 저장한다.
      const cover = images[0];
      const coverImageUrl = cover
        ? cover.file
          ? (await uploadFile(cover.file, 'blogs-images')).publicUrl
          : cover.url
        : '';
      const portfolioImageUrls = await Promise.all(
        portfolioImages.map(async (img) => {
          if (!img.file) return img.url;
          const { publicUrl } = await uploadFile(img.file, 'blogs-images');
          return publicUrl;
        }),
      );
      await onSubmit(
        {
          title,
          slug,
          cover_image_url: coverImageUrl,
          portfolio_images: portfolioImageUrls,
          content,
          category,
          status,
        },
        status,
      );
    } catch (err) {
      setAlertMessage(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setLoading(false);
    }
  };

  const saveButtonLabel = loading
    ? '저장 중...'
    : isPublished
      ? submitLabel
      : '임시저장';

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
                {PUBLISHED_LABEL}
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
              {saveButtonLabel}
            </button>
          </div>
        </div>

        {/* 메인 폼 카드 */}
        <div className="w-full lg:flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="space-y-5">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="글 제목을 입력하세요"
                className={INPUT_CLASS}
              />
            </div>

            {/* 슬러그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                슬러그(URL) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-friendly-slug"
                className={`${INPUT_CLASS} font-mono`}
              />
              <p className="mt-1 text-xs text-gray-400">
                API URL: /api/v1/blog/{slug || 'slug'}
              </p>
            </div>

            {/* 커버 이미지 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  썸네일 대표 이미지
                </label>
                <span className="text-xs text-gray-400">
                  권장 사이즈: 1640 × 1000px (1.64 : 1)
                </span>
              </div>
              <SortableImageGrid
                images={images}
                onReorder={reorderImages}
                onRemove={removeImage}
                onAddFiles={handleImagesSelect}
                maxImages={MAX_IMAGES}
                aspectClassName="aspect-[1.64/1]"
                helperText={`JPG, PNG, WebP · 최대 5MB · 최대 ${MAX_IMAGES}장`}
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <Dropdown
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(v) => setCategory(v as PostCategory)}
              />
            </div>

            {/* 본문 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                본문
              </label>
              <RichEditor value={content} onChange={setContent} />
            </div>

            {/* 갤러리 사진 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  갤러리 사진
                </label>
                <span className="text-xs text-gray-400">
                  권장 사이즈: 1080 × 1350px
                </span>
              </div>
              <SortableImageGrid
                images={portfolioImages}
                onReorder={reorderPortfolioImages}
                onRemove={removePortfolioImage}
                onAddFiles={handlePortfolioImagesSelect}
                maxImages={MAX_IMAGES}
                helperText={`JPG, PNG, WebP · 최대 5MB · 최대 ${MAX_IMAGES}장`}
              />
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
              {saveButtonLabel}
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
                {PUBLISHED_LABEL}
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
