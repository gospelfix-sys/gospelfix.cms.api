'use client';

import { useRecoilValue, useResetRecoilState } from 'recoil';
import { useRouter } from 'next/navigation';
import { createClient } from '@/libs/supabase/client';
import { sessionAtom, authUserAtom, authLoadingAtom } from '@/store/atoms/authAtom';
import { userProfileAtom } from '@/store/atoms/userAtom';
import { isAuthenticatedSelector, isAdminSelector } from '@/store/selectors/authSelector';

export function useAuth() {
  const session = useRecoilValue(sessionAtom);
  const user = useRecoilValue(authUserAtom);
  const loading = useRecoilValue(authLoadingAtom);
  const profile = useRecoilValue(userProfileAtom);
  const isAuthenticated = useRecoilValue(isAuthenticatedSelector);
  const isAdmin = useRecoilValue(isAdminSelector);

  const resetAuthUser = useResetRecoilState(authUserAtom);
  const resetSession = useResetRecoilState(sessionAtom);
  const resetProfile = useResetRecoilState(userProfileAtom);
  const resetLoading = useResetRecoilState(authLoadingAtom);

  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    resetAuthUser();
    resetSession();
    resetProfile();
    resetLoading();
    router.push('/sign/in');
  };

  return { session, user, loading, profile, isAuthenticated, isAdmin, signOut };
}
