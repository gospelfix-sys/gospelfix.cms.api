'use server';

import {
  createProductSubCategory,
  updateProductSubCategory,
  deleteProductSubCategory,
  duplicateProductSubCategory,
  updateProductSubCategoriesSortOrder,
} from '@/libs/supabase/queries/product-sub-categories.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type {
  ProductSubCategory,
  ProductSubCategoryFormInput,
} from '@/libs/supabase/queries/product-sub-categories.admin';

export async function createProductSubCategoryAction(
  input: ProductSubCategoryFormInput,
): Promise<ProductSubCategory> {
  await requireAdminPage();
  return createProductSubCategory(input);
}

export async function updateProductSubCategoryAction(
  id: string,
  input: ProductSubCategoryFormInput,
): Promise<ProductSubCategory> {
  await requireAdminPage();
  return updateProductSubCategory(id, input);
}

export async function deleteProductSubCategoryAction(id: string): Promise<void> {
  await requireAdminPage();
  return deleteProductSubCategory(id);
}

export async function duplicateProductSubCategoryAction(id: string): Promise<ProductSubCategory> {
  await requireAdminPage();
  return duplicateProductSubCategory(id);
}

export async function updateProductSubCategoriesSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updateProductSubCategoriesSortOrder(updates);
}
