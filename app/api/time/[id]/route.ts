import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Attribute a session to a client or a build.
//
// The hook attributes automatically from the working directory, but it will not
// guess: a session in a folder the hub doesn't recognise lands unattributed and
// waits for a human. This is that human.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Client and build are alternatives, not a pair — setting one clears the
  // other so a session can't be double-counted against both.
  if ('client_id' in body) {
    patch.client_id = body.client_id || null;
    if (body.client_id) patch.venture_id = null;
  }
  if ('venture_id' in body) {
    patch.venture_id = body.venture_id || null;
    if (body.venture_id) patch.client_id = null;
  }
  if (typeof body?.summary === 'string') patch.summary = body.summary.trim().slice(0, 500) || null;
  if (typeof body?.note === 'string') patch.note = body.note.trim() || null;

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('time_sessions')
    .update(patch)
    .eq('id', id)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
