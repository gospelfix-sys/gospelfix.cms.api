'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import type { ProductSubCategoryFormInput } from '@/libs/supabase/queries/product-sub-categories.admin';

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm';

const VALUE_REGEX = /^[a-z][a-z0-9_]*$/;

interface ProductSubCategoryFormProps {
  initialValues?: Partial<ProductSubCategoryFormInput>;
  onSubmit: (input: ProductSubCategoryFormInput) => Promise<void>;
  submitLabel?: string;
}

export default function ProductSubCategoryForm({
  initialValues,
  onSubmit,
  submitLabel = '등록',
}: ProductSubCategoryFormProps) {
  const router = useRouter();
  // value는 moda_products.sub_categories(jsonb 배열)가 그대로 참조하는 안정적인
  // key라, 수정 화면에서 값을 바꾸면 기존 상품과의 매핑이 깨진다(orphan) — 생성
  // 화면에서만 입력 가능하게 하고, 이 값의 존재 여부(initialValues)로 신규/수정
  // 화면을 구분한다.
  const isEdit = !!initialValues;

  const [value, setValue] = useState(initialValues?.value ?? '');
  const [label, setLabel] = useState(initialValues?.label ?? '');
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const handleSave = async () => {
    if (loading) return;
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setAlertMessage('value를 입력해주세요.');
      return;
    }
    if (!VALUE_REGEX.test(trimmedValue)) {
      setAlertMessage('value는 소문자로 시작하는 영문 소문자/숫자/언더스코어만 가능합니다.');
      return;
    }
    if (!label.trim()) {
      setAlertMessage('라벨을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        value: trimmedValue,
        label: label.trim(),
        is_active: isActive,
      });
    } catch (error) {
      setAlertMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-xl w-full space-y-4">
        {/* 모바일 전용 액션 바: 헤더(h-14) 바로 아래 sticky로 고정해 폼이 길어져도 저장 버튼에 항상 접근 가능 */}
        <div className="lg:hidden sticky top-14 z-20 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="mr-auto text-sm text-gray-700 dark:text-gray-300">
              활성 {isActive ? 'ON' : 'OFF'}
            </span>
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              value
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              readOnly={isEdit}
              placeholder="leisure_sports"
              className={`${INPUT_CLASS} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isEdit
                ? '이미 등록된 상품이 이 값을 참조할 수 있어 수정 화면에서는 변경할 수 없습니다.'
                : '영문 소문자로 시작하는 snake_case (예: leisure_sports) — 등록 후에는 변경할 수 없습니다.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              라벨
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="레저/스포츠"
              className={INPUT_CLASS}
            />
          </div>

          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            ariaLabel={`소분류 ${isActive ? '비활성화' : '활성화'}`}
            label={`활성 ${isActive ? 'ON' : 'OFF'}`}
          />

          <div className="hidden lg:flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2.5 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? '저장 중...' : submitLabel}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
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
