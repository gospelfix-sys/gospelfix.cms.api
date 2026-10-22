import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  requestSellerRole,
  AccountError,
} from '@/libs/supabase/queries/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('seller_request');
  if (disabledError) return disabledError;

  try {
    const user = await requireBearerUser(request);
    await requestSellerRole(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/seller-request] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
