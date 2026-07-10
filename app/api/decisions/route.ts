import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// POST /api/decisions — propose a business decision (starts at 'idea').
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const title = (body?.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from('decisions')
    .insert({
      title,
      summary: body?.summary ?? null,
      kind: body?.kind ?? 'other',
      status: 'idea',
      proposed_by: userId,
      client_id: body?.client_id ?? null,
      venture_id: body?.venture_id ?? null,
      est_hours_per_week: body?.est_hours_per_week ?? null,
      effort_role: body?.effort_role ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('decision_events').insert({
    decision_id: data.id,
    from_status: null,
    to_status: 'idea',
    actor_id: userId,
    note: 'proposed',
  });
  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'note',
    actor_id: userId,
    title: `decision proposed: ${title}`,
    decision_id: data.id,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
