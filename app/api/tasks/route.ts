import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const SOURCES = ['git', 'freshbooks', 'cal', 'crm', 'hub'];

// Queue a dated task — the raw material of the 2-week look-ahead.
//
// Distinct from POST /api/work-items, which asserts "I am working on this NOW"
// and closes out your previous now-item. This just puts something on the
// calendar; it doesn't claim you've started.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const dueOn = typeof body?.due_on === 'string' && body.due_on ? body.due_on : null;
  if (!dueOn) return NextResponse.json({ error: 'due_on is required' }, { status: 400 });
  if (Number.isNaN(new Date(dueOn).getTime())) {
    return NextResponse.json({ error: 'due_on must be a date (YYYY-MM-DD)' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      // A task can be assigned to either founder; defaults to whoever queued it.
      profile_id: typeof body?.profile_id === 'string' && body.profile_id ? body.profile_id : userId,
      title,
      note: body?.note?.trim() || null,
      due_on: dueOn,
      source: SOURCES.includes(body?.source) ? body.source : 'hub',
      client_id: body?.client_id || null,
      venture_id: body?.venture_id || null,
      repo_id: body?.repo_id || null,
      status: 'next',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
