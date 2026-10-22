'use server';

import {
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  duplicatePortfolio,
  updatePortfoliosSortOrder,
} from '@/libs/supabase/queries/portfolios.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type { Portfolio, PortfolioFormInput } from '@/types/portfolio';

export async function createPortfolioAction(input: PortfolioFormInput): Promise<Portfolio> {
  await requireAdminPage();
  return createPortfolio(input);
}

export async function updatePortfolioAction(id: string, input: PortfolioFormInput): Promise<Portfolio> {
  await requireAdminPage();
  return updatePortfolio(id, input);
}

export async function deletePortfolioAction(id: string): Promise<void> {
  await requireAdminPage();
  return deletePortfolio(id);
}

export async function duplicatePortfolioAction(id: string): Promise<Portfolio> {
  await requireAdminPage();
  return duplicatePortfolio(id);
}

export async function updatePortfoliosSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updatePortfoliosSortOrder(updates);
}
