'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/libs/supabase/server';
import { getProfileById } from '@/libs/supabase/queries/account';

export async function signInAction(email: string, password: string): Promise<{ error: string } | void> {
  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해주세요.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const profile = await getProfileById(data.user.id);

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return { error: '관리자 권한이 없는 계정입니다.' };
  }

  redirect('/users');
}
