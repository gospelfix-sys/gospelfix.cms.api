'use client';

import { useRouter } from 'next/navigation';
import ReferralBannerForm from '@/components/admin/ReferralBannerForm';
import { createReferralBannerAction } from '../actions';
import type { ReferralBannerFormInput } from '@/libs/supabase/queries/referral-banners.admin';

export default function NewReferralBannerForm() {
  const router = useRouter();

  const handleSubmit = async (input: ReferralBannerFormInput) => {
    await createReferralBannerAction(input);
    router.push('/referral-banners');
    router.refresh();
  };

  return <ReferralBannerForm onSubmit={handleSubmit} />;
}
