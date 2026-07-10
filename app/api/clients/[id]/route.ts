import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const EDITABLE = [
  'name', 'stage', 'health', 'industry', 'website',
  'contact_name', 'contact_email', 'contact_phone', 'notes', 'fb_client_id',
] as const;

// PATCH /api/clients/[id] — update fields; stage/health changes are logged
// to client_events (append-only history → feeds the awareness loop).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (k in body) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { supabase, userId } = auth;

  // Snapshot for change detection
  const { data: before } = await supabase
    .from('clients')
    .select('stage, health')
    .eq('id', id)
    .single();
  if (!before) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  const { error } = await supabase.from('clients').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events: { client_id: string; kind: string; body: string; actor_id: string }[] = [];
  if ('stage' in updates && updates.stage !== before.stage) {
    events.push({ client_id: id, kind: 'stage_change', body: `${before.stage} → ${updates.stage}`, actor_id: userId });
  }
  if ('health' in updates && updates.health !== before.health) {
    events.push({ client_id: id, kind: 'health_change', body: `${before.health ?? 'not set'} → ${updates.health ?? 'not set'}`, actor_id: userId });
  }
  if (events.length) await supabase.from('client_events').insert(events);

  return NextResponse.json({ ok: true });
}

// POST /api/clients/[id] — append a note to the client's history.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const note = (body?.note ?? '').trim();
  if (!note) return NextResponse.json({ error: 'note is required' }, { status: 400 });

  const { supabase, userId } = auth;
  const { error } = await supabase.from('client_events').insert({
    client_id: id,
    kind: 'note',
    body: note,
    actor_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
