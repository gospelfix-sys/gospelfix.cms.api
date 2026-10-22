'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Dropdown } from '@/components/ui/dropdown';
import type {
  BannerType,
  ReferralBannerFormInput,
} from '@/libs/supabase/queries/referral-banners.admin';

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm';

const BANNER_TYPE_OPTIONS: {
  value: BannerType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'referral',
    label: '추천인 코드 공유',
    hint: '노출 순서 1순위 활성 배너의 할인율이 실제 추천 쿠폰 발급에 적용됩니다.',
  },
  {
    value: 'review',
    label: '리뷰 작성 보상',
    hint: '노출 순서 1순위 활성 배너의 할인율이 실제 리뷰 작성 보상 쿠폰 발급에 적용됩니다.',
  },
  {
    value: 'signup',
    label: '회원가입 혜택',
    hint: '노출 순서 1순위 활성 배너의 할인율이 실제 회원가입 혜택 쿠폰 발급에 적용됩니다.',
  },
  {
    value: 'general',
    label: '일반 홍보',
    hint: '쿠폰 발급과 무관한 단순 홍보 문구입니다.',
  },
];

interface ReferralBannerFormProps {
  initialValues?: Partial<ReferralBannerFormInput>;
  onSubmit: (input: ReferralBannerFormInput) => Promise<void>;
  submitLabel?: string;
}

export default function ReferralBannerForm({
  initialValues,
  onSubmit,
  submitLabel = '등록',
}: ReferralBannerFormProps) {
  const router = useRouter();

  const [message, setMessage] = useState(initialValues?.message ?? '');
  const [discountRate, setDiscountRate] = useState(
    String(initialValues?.discount_rate ?? 50),
  );
  const [isEnabled, setIsEnabled] = useState(initialValues?.is_enabled ?? true);
  const [showReferralActions, setShowReferralActions] = useState(
    initialValues?.show_referral_actions ?? true,
  );
  const [bannerType, setBannerType] = useState<BannerType>(
    initialValues?.banner_type ?? 'referral',
  );
  const bannerTypeOption = BANNER_TYPE_OPTIONS.find(
    (option) => option.value === bannerType,
  );
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const handleSave = async () => {
    if (loading) return;
    if (!message.trim()) {
      setAlertMessage('배너 문구를 입력해주세요.');
      return;
    }
    const parsedRate = Number(discountRate);
    if (!Number.isInteger(parsedRate) || parsedRate < 1 || parsedRate > 100) {
      setAlertMessage('할인율은 1~100 사이의 정수여야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        message: message.trim(),
        discount_rate: parsedRate,
        is_enabled: isEnabled,
        show_referral_actions: showReferralActions,
        banner_type: bannerType,
      });
    } catch (error) {
      setAlertMessage(
        error instanceof Error ? error.message : '저장에 실패했습니다.',
      );
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
              배너 노출 {isEnabled ? 'ON' : 'OFF'}
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
              배너 유형
            </label>
            <Dropdown
              options={BANNER_TYPE_OPTIONS.map((option) => option.label)}
              value={bannerTypeOption?.label ?? ''}
              onChange={(label) => {
                const selected = BANNER_TYPE_OPTIONS.find(
                  (option) => option.label === label,
                );
                if (selected) setBannerType(selected.value);
              }}
              placeholder="배너 유형 선택"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {bannerTypeOption?.hint}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              배너 문구
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="추천인 코드를 공유하면 나와 친구 모두 50% 할인 쿠폰을 받아요"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              할인율 (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            ariaLabel={`배너 ${isEnabled ? '비활성화' : '활성화'}`}
            label={`배너 노출 ${isEnabled ? 'ON' : 'OFF'}`}
          />

          <div>
            <Switch
              checked={showReferralActions}
              onCheckedChange={setShowReferralActions}
              ariaLabel={`코드/버튼 ${showReferralActions ? '숨김' : '표시'}`}
              label={`코드·버튼 영역 ${showReferralActions ? 'ON' : 'OFF'}`}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              OFF로 두면 배너 문구만 노출되고, 하단의 추천인 코드 배지 + 코드
              복사/링크 공유 버튼은 숨겨집니다. 추천 관련이 아닌 일반 홍보
              문구(예: 리뷰 작성 쿠폰 안내)에 사용하세요.
            </p>
          </div>

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
