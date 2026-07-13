import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const LANES = ['Client', 'Product', 'Service', 'Ops'];

// Create an initiative — a bet someone is choosing to make. Hand-kept on
// purpose: initiatives are NOT derived from repo activity, they're the curated
// layer above it.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId, name } = auth;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const lane = LANES.includes(body?.lane) ? body.lane : 'Client';
  const ownerId = typeof body?.owner_id === 'string' && body.owner_id ? body.owner_id : userId;

  const { data, error } = await supabase
    .from('initiatives')
    .insert({
      title,
      why: typeof body?.why === 'string' && body.why.trim() ? body.why.trim() : null,
      owner_id: ownerId,
      lane,
      status: 'idea',
      client_id: body?.client_id || null,
      venture_id: body?.venture_id || null,
      repo_id: body?.repo_id || null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'initiative_created',
    title: `▸ initiative: ${title}`,
    body: `Created by ${name}`,
    actor_id: userId,
    client_id: body?.client_id || null,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
