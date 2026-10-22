'use server';

import {
  createReferralBanner,
  updateReferralBanner,
  deleteReferralBanner,
  duplicateReferralBanner,
  updateReferralBannersSortOrder,
} from '@/libs/supabase/queries/referral-banners.admin';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import type {
  ReferralBanner,
  ReferralBannerFormInput,
} from '@/libs/supabase/queries/referral-banners.admin';

export async function createReferralBannerAction(
  input: ReferralBannerFormInput,
): Promise<ReferralBanner> {
  await requireAdminPage();
  return createReferralBanner(input);
}

export async function updateReferralBannerAction(
  id: string,
  input: ReferralBannerFormInput,
): Promise<ReferralBanner> {
  await requireAdminPage();
  return updateReferralBanner(id, input);
}

export async function deleteReferralBannerAction(id: string): Promise<void> {
  await requireAdminPage();
  return deleteReferralBanner(id);
}

export async function duplicateReferralBannerAction(id: string): Promise<ReferralBanner> {
  await requireAdminPage();
  return duplicateReferralBanner(id);
}

export async function updateReferralBannersSortOrderAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await requireAdminPage();
  return updateReferralBannersSortOrder(updates);
}
