'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { deleteUser, updateUserRole } from '@/libs/supabase/queries/users';
import {
  getSellerIdentity,
  setSellerIdentityStatus,
} from '@/libs/supabase/queries/seller-identity';

export async function deleteUserAction(id: string): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 계정은 삭제할 수 없습니다.');

  await deleteUser(id);
  revalidatePath('/users');
}

// 이미 판매자인 계정이 유예기간 중 신원정보를 제출했을 때 role 변경 없이 신원정보만 승인한다
export async function approveSellerIdentityAction(id: string): Promise<void> {
  await requireAdminPage();
  const identity = await getSellerIdentity(id);
  if (!identity) throw new Error('판매자 신원정보가 제출되지 않았습니다.');
  if (!identity.phoneVerified || !identity.emailVerified) {
    throw new Error('휴대폰·이메일 인증이 완료되지 않았습니다.');
  }
  if (identity.sellerType === 'business' && !identity.businessVerified) {
    throw new Error('사업자 정보가 국세청 확인을 통과하지 않았습니다.');
  }
  await setSellerIdentityStatus(id, 'approved');
  revalidatePath('/users');
}

export async function updateUserRoleAction(
  id: string,
  role: 'user' | 'admin' | 'seller',
): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 역할은 변경할 수 없습니다.');

  // 판매자 승인은 신원정보(휴대폰·이메일 인증, 사업자는 국세청 확인)가 갖춰진 경우에만 한다
  if (role === 'seller') {
    const identity = await getSellerIdentity(id);
    if (!identity) throw new Error('판매자 신원정보가 제출되지 않았습니다.');
    if (!identity.phoneVerified || !identity.emailVerified) {
      throw new Error('휴대폰·이메일 인증이 완료되지 않았습니다.');
    }
    if (identity.sellerType === 'business' && !identity.businessVerified) {
      throw new Error('사업자 정보가 국세청 확인을 통과하지 않았습니다.');
    }
  }

  await updateUserRole(id, role);
  if (role === 'seller') await setSellerIdentityStatus(id, 'approved');
  revalidatePath('/users');
}
