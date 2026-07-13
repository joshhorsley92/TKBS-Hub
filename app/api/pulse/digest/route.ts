import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { writeDigest } from '@/lib/pulse-digest';

export const maxDuration = 60;

// The Pulse digest. `brief=1` returns the two-line highlights form (compact
// density); otherwise the full paragraph.
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const brief = new URL(request.url).searchParams.get('brief') === '1';
  const { text, ai, facts } = await writeDigest(brief);

  return NextResponse.json({ ok: true, text, ai, facts });
}
