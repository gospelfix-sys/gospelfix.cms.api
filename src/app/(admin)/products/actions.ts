'use server';

import {
  deleteProduct,
  duplicateProduct,
  updateProductsSortOrder,
  approveProduct,
  rejectProduct,
} from '@/libs/supabase/queries/products.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type { Product } from '@/types/product';

export async function deleteProductAction(id: string): Promise<void> {
  await requireAdminPage();
  return deleteProduct(id);
}

export async function duplicateProductAction(id: string): Promise<Product> {
  await requireAdminPage();
  return duplicateProduct(id);
}

// 판매자(seller)가 등록/재제출(status='pending')한 상품을 관리자가 검수한다
// (project_product_crud_migration_to_mypage 메모리 — 관리자 수동 승인 정책). seller가
// 직접 승인/반려할 수 있으면 이 정책 자체가 무력화되므로 관리자 재검증 필수.
export async function approveProductAction(id: string): Promise<Product> {
  await requireAdminPage();
  return approveProduct(id);
}

export async function rejectProductAction(id: string): Promise<Product> {
  await requireAdminPage();
  return rejectProduct(id);
}

export async function updateProductsSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updateProductsSortOrder(updates);
}
