import { createClient } from '@/libs/supabase/client';

// 브라우저 전용('use client' 컴포넌트에서만 import). next/headers 등 서버 전용 import를 추가하지 말 것 —
// auth.ts와 합쳐지면 클라이언트 번들에 서버 전용 코드가 섞여 빌드가 깨진다.
export async function signUpWithEmail(
  email: string,
  password: string,
  redirectTo: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  return { error: error?.message ?? null };
}
