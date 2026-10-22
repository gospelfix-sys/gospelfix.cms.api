import { atom } from 'recoil';
import type { Session, User } from '@supabase/supabase-js';

export const sessionAtom = atom<Session | null>({
  key: 'sessionAtom',
  default: null,
});

export const authUserAtom = atom<User | null>({
  key: 'authUserAtom',
  default: null,
});

export const authLoadingAtom = atom<boolean>({
  key: 'authLoadingAtom',
  default: true,
});
