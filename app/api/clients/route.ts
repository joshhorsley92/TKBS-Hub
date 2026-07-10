import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// POST /api/clients — create a client (name required; stage optional).
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const name = (body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name,
      slug,
      stage: body?.stage ?? 'prospect',
      industry: body?.industry ?? null,
      website: body?.website ?? null,
      notes: body?.notes ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('client_events').insert({
    client_id: data.id,
    kind: 'note',
    body: 'Client created',
    actor_id: userId,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
