import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const EDITABLE_KEYS = ['blended_hourly_rate', 'weekly_capacity_hours', 'pipeline_confidence'];

// PATCH /api/assumptions — set a planning constant. Values are JSON; null
// means "deliberately not set" (rendered as NOT SET, never invented).
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const key = body?.key;
  if (!EDITABLE_KEYS.includes(key)) {
    return NextResponse.json({ error: `key must be one of: ${EDITABLE_KEYS.join(', ')}` }, { status: 400 });
  }
  if (!('value' in (body ?? {}))) {
    return NextResponse.json({ error: 'value is required (null to unset)' }, { status: 400 });
  }

  const { supabase, userId } = auth;
  const { error } = await supabase
    .from('assumptions')
    .update({ value: body.value, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'note',
    actor_id: userId,
    title: `assumption set: ${key} = ${JSON.stringify(body.value)}`,
  });

  return NextResponse.json({ ok: true });
}
