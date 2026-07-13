import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// A blank form field means "not known yet", and it has to land in the database
// as NULL. Storing '' instead would turn an unknown into a known-empty value —
// and clients.since is a date column, where '' is simply an error.
const orNull = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

// POST /api/clients — create a client. Only `name` is required; every other
// relationship fact (industry, website, contact, engagement, since) is optional
// and nullable, because on day one that is genuinely all we know.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const name = orNull(body?.name);
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
      stage: orNull(body?.stage) ?? 'prospect',
      industry: orNull(body?.industry),
      website: orNull(body?.website),
      notes: orNull(body?.notes),
      engagement: orNull(body?.engagement),
      since: orNull(body?.since),
      contact_name: orNull(body?.contact_name),
      contact_email: orNull(body?.contact_email),
      contact_phone: orNull(body?.contact_phone),
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
