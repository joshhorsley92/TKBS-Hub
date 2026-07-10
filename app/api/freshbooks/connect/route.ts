import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { authorizeUrl } from '@/lib/freshbooks';

// GET /api/freshbooks/connect — kicks off the one-time consent flow.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.redirect(authorizeUrl());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'FreshBooks app not configured' },
      { status: 500 },
    );
  }
}
