import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STAGES = ['new', 'qualified', 'proposal', 'won', 'lost'];

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Create a lead. Every field is what a human actually knows — `fit` and
// `est_value` stay null until someone scores/estimates them, and the funnel
// renders those as unknown rather than guessing.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId, name } = auth;

  const body = await request.json().catch(() => null);
  const leadName = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!leadName) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const fit = numOrNull(body?.fit);
  if (fit !== null && (fit < 0 || fit > 100)) {
    return NextResponse.json({ error: 'fit must be 0–100' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name: leadName,
      campaign_id: body?.campaign_id || null,
      fit,
      stage: STAGES.includes(body?.stage) ? body.stage : 'new',
      est_value: numOrNull(body?.est_value),
      recurring: Boolean(body?.recurring),
      industry: body?.industry?.trim() || null,
      contact: body?.contact?.trim() || null,
      note: body?.note?.trim() || null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'lead',
    title: `▸ lead: ${leadName}`,
    body: `Added by ${name}`,
    actor_id: userId,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
