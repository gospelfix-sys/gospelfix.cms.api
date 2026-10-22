import { redirect } from 'next/navigation';
import { createClient } from '@/libs/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign/in');
  }

  redirect('/users');
}
