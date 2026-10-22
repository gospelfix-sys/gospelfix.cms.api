import Link from 'next/link';
import { Plus } from 'lucide-react';
import EmptyState from '@/components/admin/EmptyState';
import ReferralBannersTable from './ReferralBannersTable';
import { getAllReferralBanners } from '@/libs/supabase/queries/referral-banners.admin';

export default async function ReferralBannersPage() {
  const banners = await getAllReferralBanners();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            롤링 배너 관리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            총 {banners.length}건 — 활성화된 배너가 노출 순서대로 마이페이지/몰
            페이지 하단에 롤링 표시됩니다.
          </p>
        </div>
        <Link
          href="/referral-banners/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity shrink-0"
        >
          <Plus size={15} />새 배너
        </Link>
      </div>

      {banners.length === 0 ? (
        <EmptyState message="등록된 배너가 없습니다" />
      ) : (
        <ReferralBannersTable banners={banners} />
      )}
    </div>
  );
}
