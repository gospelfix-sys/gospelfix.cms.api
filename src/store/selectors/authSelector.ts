import { selector } from 'recoil';
import { authUserAtom, authLoadingAtom } from '@/store/atoms/authAtom';
import { userProfileAtom } from '@/store/atoms/userAtom';

export const isAuthenticatedSelector = selector<boolean>({
  key: 'isAuthenticatedSelector',
  get: ({ get }) => {
    const user = get(authUserAtom);
    const loading = get(authLoadingAtom);
    return !loading && user !== null;
  },
});

export const isAdminSelector = selector<boolean>({
  key: 'isAdminSelector',
  get: ({ get }) => {
    const loading = get(authLoadingAtom);
    if (loading) return false;
    const profile = get(userProfileAtom);
    return profile?.role === 'admin';
  },
});
