'use client';

import { useRecoilValue, useSetRecoilState } from 'recoil';
import { userProfileAtom } from '@/store/atoms/userAtom';

export function useUser() {
  const profile = useRecoilValue(userProfileAtom);
  const setProfile = useSetRecoilState(userProfileAtom);

  return { profile, setProfile };
}
