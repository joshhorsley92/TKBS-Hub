import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSignals } from '@/lib/board';

// Polled by the Live signals module.
//
// The reference prototype faked this — it appended a synthetic event every five
// seconds so the board looked alive. This returns the real activity river. If
// nothing has happened, nothing new appears, and the module says so.
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 8, 50);

  const signals = await getSignals(limit);
  return NextResponse.json({ ok: true, signals });
}
