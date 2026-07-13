import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STATUSES = ['idea', 'evaluating', 'active', 'paused', 'shipped'];
const LANES = ['Client', 'Product', 'Service', 'Ops'];
const HEALTHS = ['green', 'yellow', 'red'];

// Edit an initiative: progress, health, status, lane, links, and the blocker.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.why === 'string') patch.why = body.why.trim() || null;
  if (typeof body.owner_id === 'string') patch.owner_id = body.owner_id;
  if (LANES.includes(body.lane)) patch.lane = body.lane;
  if (STATUSES.includes(body.status)) patch.status = body.status;
  if (body.health === null || HEALTHS.includes(body.health)) patch.health = body.health;

  if (body.progress !== undefined) {
    const p = Number(body.progress);
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      return NextResponse.json({ error: 'progress must be between 0 and 1' }, { status: 400 });
    }
    patch.progress = p;
  }

  // The blocker is one of: a teammate, someone outside the company, or nobody.
  // Setting one clears the other so they can never both be true.
  if ('blocked_on' in body) {
    const b = body.blocked_on;
    if (b === null || b === 'none') {
      patch.blocked_on_profile_id = null;
      patch.blocked_on_external = false;
      patch.block_note = null;
    } else if (b === 'external') {
      patch.blocked_on_profile_id = null;
      patch.blocked_on_external = true;
    } else if (typeof b === 'string') {
      patch.blocked_on_profile_id = b;
      patch.blocked_on_external = false;
    }
  }
  if (typeof body.block_note === 'string') patch.block_note = body.block_note.trim() || null;

  if ('client_id' in body) patch.client_id = body.client_id || null;
  if ('venture_id' in body) patch.venture_id = body.venture_id || null;
  if ('repo_id' in body) patch.repo_id = body.repo_id || null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('initiatives').update(patch).eq('id', id).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await auth.supabase.from('initiatives').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
