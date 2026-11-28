'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { deleteUser, updateUserRole } from '@/libs/supabase/queries/users';
import {
  getSellerIdentity,
  setSellerIdentityStatus,
  setSellerTaxType,
} from '@/libs/supabase/queries/seller-identity';
import {
  BusinessVerifyError,
  fetchBusinessTaxType,
} from '@/libs/nts/businessVerify';

export async function deleteUserAction(id: string): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 계정은 삭제할 수 없습니다.');

  await deleteUser(id);
  revalidatePath('/users');
}

// 사업자는 국세청 진위확인이 승인 조건이다. 연락처는 인증하지 않으므로 개인은 관리자가 직접 확인해 승인한다
function assertIdentityApprovable(
  identity: NonNullable<Awaited<ReturnType<typeof getSellerIdentity>>>,
): void {
  // 개인은 연락처 인증이 없어 관리자가 직접 확인한 뒤 승인한다
  if (identity.sellerType === 'business' && !identity.businessVerified) {
    throw new Error('사업자 정보가 국세청 확인을 통과하지 않았습니다.');
  }
}

// 사업자의 과세유형을 국세청에서 다시 조회해 저장한다. 부가세 가산 대상(일반과세자) 판단 근거가 된다
async function refreshTaxType(
  userId: string,
  identity: NonNullable<Awaited<ReturnType<typeof getSellerIdentity>>>,
): Promise<void> {
  if (identity.sellerType !== 'business' || !identity.businessNumber) return;
  const taxType = await fetchBusinessTaxType(identity.businessNumber);
  await setSellerTaxType(userId, taxType);
}

export async function refreshSellerTaxTypeAction(id: string): Promise<void> {
  await requireAdminPage();
  const identity = await getSellerIdentity(id);
  if (!identity || identity.sellerType !== 'business') {
    throw new Error('사업자 판매자만 과세유형을 조회할 수 있습니다.');
  }
  try {
    await refreshTaxType(id, identity);
  } catch (err) {
    if (err instanceof BusinessVerifyError) throw new Error(err.message);
    throw err;
  }
  revalidatePath('/users');
}

// 승인 시점에는 최신 과세유형으로 맞추되, 국세청 장애가 승인을 막지는 않게 한다(기존 값 유지)
async function refreshTaxTypeBestEffort(
  userId: string,
  identity: NonNullable<Awaited<ReturnType<typeof getSellerIdentity>>>,
): Promise<void> {
  try {
    await refreshTaxType(userId, identity);
  } catch (err) {
    if (!(err instanceof BusinessVerifyError)) throw err;
    console.warn('[users/actions] 과세유형 재조회 실패:', err.message);
  }
}

// 이미 판매자인 계정이 유예기간 중 신원정보를 제출했을 때 role 변경 없이 신원정보만 승인한다
export async function approveSellerIdentityAction(id: string): Promise<void> {
  await requireAdminPage();
  const identity = await getSellerIdentity(id);
  if (!identity) throw new Error('판매자 신원정보가 제출되지 않았습니다.');
  assertIdentityApprovable(identity);
  await refreshTaxTypeBestEffort(id, identity);
  await setSellerIdentityStatus(id, 'approved');
  revalidatePath('/users');
}

export async function updateUserRoleAction(
  id: string,
  role: 'user' | 'admin' | 'seller',
): Promise<void> {
  const currentUser = await requireAdminPage();
  if (id === currentUser.id) throw new Error('본인 역할은 변경할 수 없습니다.');

  // 판매자 승인은 신원정보(사업자는 국세청 확인)가 갖춰진 경우에만 한다
  if (role === 'seller') {
    const identity = await getSellerIdentity(id);
    if (!identity) throw new Error('판매자 신원정보가 제출되지 않았습니다.');
    assertIdentityApprovable(identity);
    await refreshTaxTypeBestEffort(id, identity);
  }

  await updateUserRole(id, role);
  if (role === 'seller') await setSellerIdentityStatus(id, 'approved');
  revalidatePath('/users');
}
