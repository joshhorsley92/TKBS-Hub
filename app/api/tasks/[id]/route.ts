import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STATUSES = ['now', 'next', 'done', 'dropped'];

// Complete (or drop) a look-ahead task.
//
// The board only shows open work: a completed task leaves the look-ahead
// entirely rather than lingering as a strikethrough. The row is kept in
// work_items with status='done' — the history is real, it just isn't clutter.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status };
  if (status === 'done' || status === 'dropped') {
    patch.finished_at = new Date().toISOString();
  }
  if (typeof body?.due_on === 'string') patch.due_on = body.due_on;

  const { data, error } = await supabase.from('work_items').update(patch).eq('id', id).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
