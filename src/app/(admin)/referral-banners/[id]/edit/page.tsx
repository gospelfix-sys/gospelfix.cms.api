import { notFound } from 'next/navigation';
import EditReferralBannerForm from './EditReferralBannerForm';
import { getReferralBannerByIdAdmin } from '@/libs/supabase/queries/referral-banners.admin';

export default async function EditReferralBannerPage({ params }: { params: { id: string } }) {
  const banner = await getReferralBannerByIdAdmin(params.id);
  if (!banner) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          배너 편집
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 truncate">{banner.message}</p>
      </div>
      <EditReferralBannerForm banner={banner} />
    </div>
  );
}
