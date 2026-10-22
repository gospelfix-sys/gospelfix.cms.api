import { NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/libs/supabase/queries/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getCurrentAdminUser();

  if (!result) {
    return NextResponse.json({ user: null, profile: null }, { status: 401 });
  }

  return NextResponse.json(result);
}
