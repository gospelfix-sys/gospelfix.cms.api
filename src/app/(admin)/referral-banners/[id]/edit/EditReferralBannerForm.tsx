'use client';

import { useRouter } from 'next/navigation';
import ReferralBannerForm from '@/components/admin/ReferralBannerForm';
import { updateReferralBannerAction } from '../../actions';
import type {
  ReferralBanner,
  ReferralBannerFormInput,
} from '@/libs/supabase/queries/referral-banners.admin';

export default function EditReferralBannerForm({ banner }: { banner: ReferralBanner }) {
  const router = useRouter();

  const handleSubmit = async (input: ReferralBannerFormInput) => {
    await updateReferralBannerAction(banner.id, input);
    router.push('/referral-banners');
    router.refresh();
  };

  const initialValues: Partial<ReferralBannerFormInput> = {
    message: banner.message,
    discount_rate: banner.discount_rate,
    is_enabled: banner.is_enabled,
    show_referral_actions: banner.show_referral_actions,
    banner_type: banner.banner_type,
  };

  return (
    <ReferralBannerForm
      initialValues={initialValues}
      onSubmit={handleSubmit}
      submitLabel="수정 완료"
    />
  );
}
