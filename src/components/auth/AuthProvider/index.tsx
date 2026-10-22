'use client';

import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { authUserAtom, authLoadingAtom } from '@/store/atoms/authAtom';
import { userProfileAtom, type UserProfile } from '@/store/atoms/userAtom';
import type { User } from '@supabase/supabase-js';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuthUser = useSetRecoilState(authUserAtom);
  const setAuthLoading = useSetRecoilState(authLoadingAtom);
  const setUserProfile = useSetRecoilState(userProfileAtom);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setAuthUser(null);
          setUserProfile(null);
          return;
        }
        const { user, profile } = (await res.json()) as {
          user: User | null;
          profile: UserProfile | null;
        };
        setAuthUser(user);
        setUserProfile(profile);
      } catch {
        setAuthUser(null);
        setUserProfile(null);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchMe();
  }, [setAuthUser, setAuthLoading, setUserProfile]);

  return <>{children}</>;
}
