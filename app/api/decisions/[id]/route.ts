import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STATUSES = ['idea', 'evaluating', 'committed', 'active', 'done', 'killed'];

// PATCH /api/decisions/[id] — move a decision through its lifecycle (or edit
// fields). Committing encodes "Joe proposes, Josh decides": decided_by is
// stamped with whoever commits (schema requires it non-null from committed on).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const { supabase, userId } = auth;
  const { data: before } = await supabase
    .from('decisions')
    .select('status, title, decided_by')
    .eq('id', id)
    .single();
  if (!before) return NextResponse.json({ error: 'decision not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const k of ['title', 'summary', 'kind', 'client_id', 'venture_id', 'est_hours_per_week', 'effort_role', 'review_after']) {
    if (k in body) updates[k] = body[k];
  }

  const nextStatus = body.status;
  if (nextStatus) {
    if (!STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: `invalid status: ${nextStatus}` }, { status: 400 });
    }
    updates.status = nextStatus;
    // First transition into a decided state stamps the decider.
    if (['committed', 'active', 'done'].includes(nextStatus) && !before.decided_by) {
      updates.decided_by = userId;
      updates.decided_at = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { error } = await supabase.from('decisions').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (nextStatus && nextStatus !== before.status) {
    await supabase.from('decision_events').insert({
      decision_id: id,
      from_status: before.status,
      to_status: nextStatus,
      actor_id: userId,
      note: body.note ?? null,
    });
    await supabase.from('work_log').insert({
      source: 'manual',
      kind: 'note',
      actor_id: userId,
      title: `decision ${nextStatus}: ${before.title}`,
      decision_id: id,
    });
  }

  return NextResponse.json({ ok: true });
}
