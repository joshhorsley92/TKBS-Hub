import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const PLATFORMS = ['meta', 'google', 'organic'];
const STATUSES = ['active', 'paused', 'ended'];

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Create a campaign. Spend / impressions / clicks are hand-entered until an ad
// platform is connected — each stays null if left blank, and the Pipeline shows
// "—" rather than zero for anything nobody has filled in.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!PLATFORMS.includes(body?.platform)) {
    return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name,
      platform: body.platform,
      status: STATUSES.includes(body?.status) ? body.status : 'active',
      spend: numOrNull(body?.spend),
      impressions: numOrNull(body?.impressions),
      clicks: numOrNull(body?.clicks),
      note: body?.note?.trim() || null,
      start_on: body?.start_on || null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
