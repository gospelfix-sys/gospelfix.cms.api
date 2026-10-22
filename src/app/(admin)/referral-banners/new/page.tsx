import NewReferralBannerForm from './NewReferralBannerForm';

export default function NewReferralBannerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          새 배너 등록
        </h1>
      </div>
      <NewReferralBannerForm />
    </div>
  );
}
