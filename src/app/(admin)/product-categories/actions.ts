'use server';

import {
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  duplicateProductCategory,
  updateProductCategoriesSortOrder,
} from '@/libs/supabase/queries/product-categories.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type {
  ProductCategory,
  ProductCategoryFormInput,
} from '@/libs/supabase/queries/product-categories.admin';

export async function createProductCategoryAction(
  input: ProductCategoryFormInput,
): Promise<ProductCategory> {
  await requireAdminPage();
  return createProductCategory(input);
}

export async function updateProductCategoryAction(
  id: string,
  input: ProductCategoryFormInput,
): Promise<ProductCategory> {
  await requireAdminPage();
  return updateProductCategory(id, input);
}

export async function deleteProductCategoryAction(id: string): Promise<void> {
  await requireAdminPage();
  return deleteProductCategory(id);
}

export async function duplicateProductCategoryAction(id: string): Promise<ProductCategory> {
  await requireAdminPage();
  return duplicateProductCategory(id);
}

export async function updateProductCategoriesSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updateProductCategoriesSortOrder(updates);
}
