'use client';

import { useState } from 'react';
import { signUpWithEmail } from '@/libs/supabase/queries/auth.client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    setMessage('');

    try {
      const { error } = await signUpWithEmail(
        email,
        password,
        `${window.location.origin}/auth/callback`,
      );
      if (error) {
        setAuthError(error);
      } else {
        setMessage('가입 확인 이메일을 발송했습니다. 이메일을 확인해 주세요.');
      }
    } catch {
      setAuthError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 sm:p-10 w-full max-w-md mx-4 sm:mx-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          회원가입
        </h1>

        <form onSubmit={handleSignUp} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              이메일
            </span>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              비밀번호 (6자 이상)
            </span>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
            />
          </label>

          {authError && (
            <p className="text-red-500 text-xs -mt-2">{authError}</p>
          )}
          {message && (
            <p className="text-green-600 dark:text-green-400 text-xs -mt-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black dark:bg-white hover:opacity-80 text-white dark:text-black rounded-lg py-3 text-sm font-medium transition-opacity mt-1 disabled:opacity-50"
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          이미 계정이 있으신가요?{' '}
          <a
            href="/sign/in"
            className="text-black dark:text-white font-medium hover:underline"
          >
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}
