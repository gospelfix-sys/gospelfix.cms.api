'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/libs/supabase/client';

const ERROR_MESSAGES: Record<string, string> = {
  not_admin:
    '관리자 권한이 없는 계정입니다. 기존 관리자에게 권한 승격을 요청해주세요.',
  auth_failed: '구글 로그인에 실패했습니다. 다시 시도해주세요.',
  no_code: '인증 정보가 없습니다. 다시 시도해주세요.',
};

function SignInForm() {
  const queryError = useSearchParams().get('error');
  const [error, setError] = useState(
    queryError ? (ERROR_MESSAGES[queryError] ?? ERROR_MESSAGES.auth_failed) : '',
  );
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/users`,
        // 로그아웃 후에도 계정 선택창을 띄워 이전 구글 계정으로 자동 로그인되지 않게 한다.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setError(ERROR_MESSAGES.auth_failed);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full bg-black hover:bg-gray-800 disabled:opacity-60 text-white rounded-lg py-3 text-sm font-medium transition-colors"
      >
        {loading ? '이동 중...' : 'Google로 로그인'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 w-full max-w-md mx-4 sm:mx-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">GOSPELFIX Admin</h1>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
