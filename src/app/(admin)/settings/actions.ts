'use server';

import { requireAdminPage } from '@/libs/supabase/queries/auth';
import { toggleApiConfig } from '@/libs/supabase/queries/content-api-configs';
import { toggleAuthApiConfig } from '@/libs/supabase/queries/auth-api-configs';

export async function toggleApiConfigAction(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  await requireAdminPage();

  await toggleApiConfig(id, isEnabled);
}

export async function toggleAuthApiConfigAction(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  await requireAdminPage();

  await toggleAuthApiConfig(id, isEnabled);
}
