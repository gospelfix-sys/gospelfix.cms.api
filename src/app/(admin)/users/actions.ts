'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { deleteUser, updateUserRole } from '@/libs/supabase/queries/users';

export async function deleteUserAction(id: string): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 계정은 삭제할 수 없습니다.');

  await deleteUser(id);
  revalidatePath('/users');
}

export async function updateUserRoleAction(
  id: string,
  role: 'user' | 'admin' | 'seller',
): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 역할은 변경할 수 없습니다.');

  await updateUserRole(id, role);
  revalidatePath('/users');
}
