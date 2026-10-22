import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json({
    SUPABASE_URL_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
}
