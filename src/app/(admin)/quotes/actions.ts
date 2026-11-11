'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { markQuoteViewedAdmin } from '@/libs/supabase/queries/quotes.admin';

export async function markQuoteViewedAction(id: string): Promise<void> {
  await requireAdminPage();

  await markQuoteViewedAdmin(id);
  revalidatePath('/quotes');
}
