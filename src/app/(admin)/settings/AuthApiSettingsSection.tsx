import { getAllAuthApiConfigs } from '@/libs/supabase/queries/auth-api-configs';
import AuthApiConfigCard from '@/components/admin/AuthApiConfigCard';

export default async function AuthApiSettingsSection() {
  const configs = await getAllAuthApiConfigs();

  if (configs.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          회원가입 · 로그인 API 설정
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          main(구매자) 앱이 server-to-server로 호출하는 인증 API를 활성화 /
          비활성화합니다.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {configs.map((config) => (
          <AuthApiConfigCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  );
}
