import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Append to an initiative's decisions log.
//
// Most status on the board is derived automatically from repo signal — this is
// the one place a human writes something down, so it's append-only: the calls
// you actually made, in the order you made them.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId, name } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const { data: initiative } = await supabase.from('initiatives').select('id, title').eq('id', id).single();
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('initiative_decisions')
    .insert({ initiative_id: id, body: text, actor_id: userId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'decision',
    title: `◆ decided: ${text}`,
    body: `On “${initiative.title}” — ${name}`,
    actor_id: userId,
  });

  return NextResponse.json({ ok: true });
}
