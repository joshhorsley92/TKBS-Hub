import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STAGES = ['new', 'qualified', 'proposal', 'won', 'lost'];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';

// Move a lead through the funnel.
//
// Winning a lead CONVERTS it into a real client record and links the two, so
// the client roster and the funnel can never drift apart. No money is written:
// the deal's value goes in as a money_line when someone actually books it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId, name } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (body?.stage !== undefined) {
    if (!STAGES.includes(body.stage)) {
      return NextResponse.json({ error: `stage must be one of ${STAGES.join(', ')}` }, { status: 400 });
    }
    patch.stage = body.stage;
  }
  if (typeof body?.note === 'string') patch.note = body.note.trim() || null;
  if (body?.fit !== undefined) patch.fit = body.fit === null ? null : Number(body.fit);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, industry, contact, client_id')
    .eq('id', id)
    .single();
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Won → make them a client, unless they already are one.
  let clientId: string | null = lead.client_id;
  if (patch.stage === 'won' && !clientId) {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({
        name: lead.name,
        slug: `${slugify(lead.name)}-${Date.now().toString(36)}`,
        stage: 'proposal',
        industry: lead.industry,
        contact_name: lead.contact,
        since: new Date().toISOString().slice(0, 10),
        notes: 'Converted from the acquisition pipeline.',
      })
      .select('id')
      .single();

    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 });
    clientId = client.id;
    patch.client_id = clientId;

    await supabase.from('client_events').insert({
      client_id: clientId,
      kind: 'note',
      body: `Converted from lead — won by ${name}.`,
      actor_id: userId,
    });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase.from('leads').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, clientId });
}
