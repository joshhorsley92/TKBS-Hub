import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Manual time entry.
//
// Claude-session tracking only sees work done inside Claude Code. Josh on a
// sales call and Savannah in FreshBooks generate no events at all — without
// this route the board would silently under-report everyone but Joe, which is
// worse than not tracking at all, because it looks like data.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;

  const body = await request.json().catch(() => null);
  const seconds = Number(body?.worked_seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return NextResponse.json({ error: 'worked_seconds must be a positive number' }, { status: 400 });
  }
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
  if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('time_sessions')
    .insert({
      source: 'manual',
      profile_id: body?.profile_id || userId,
      client_id: body?.client_id || null,
      venture_id: body?.venture_id || null,
      started_at: body?.started_at || new Date().toISOString(),
      worked_seconds: Math.round(seconds),
      summary: summary.slice(0, 500),
      // A hand-logged hour burns no Claude tokens. Zero here is a real zero,
      // not an unknown — nothing was spent.
      imputed_cost: 0,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
