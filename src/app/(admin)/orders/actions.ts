'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { confirmOrderPaymentAdmin } from '@/libs/supabase/queries/orders.admin';

export async function confirmOrderPaymentAction(id: string): Promise<void> {
  await requireAdminPage();

  const confirmed = await confirmOrderPaymentAdmin(id);
  if (!confirmed) {
    throw new Error('이미 처리되었거나 입금확인중 상태가 아닙니다.');
  }

  revalidatePath('/orders');
}
