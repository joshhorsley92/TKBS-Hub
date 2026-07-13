import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Edit a build (a venture): the hand-entered engineering figure and the blurb.
//
// ventures.eng_hours has NO automatic source — FreshBooks time entries would be
// one, and they aren't wired. A human typing it here is the only honest way the
// number can exist, so this route is the whole provenance of that field. Sending
// null clears it back to unknown ("—"), which is a legitimate thing to want.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ('eng_hours' in body) {
    const raw = body.eng_hours;
    if (raw === null || raw === '') {
      patch.eng_hours = null;
    } else {
      const h = Number(raw);
      // numeric(7,1) — anything outside this is a typo, not a measurement.
      if (!Number.isFinite(h) || h < 0 || h > 999_999) {
        return NextResponse.json({ error: 'eng_hours must be a number between 0 and 999999' }, { status: 400 });
      }
      patch.eng_hours = h;
    }
  }

  if ('blurb' in body) {
    patch.blurb = typeof body.blurb === 'string' && body.blurb.trim() ? body.blurb.trim() : null;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('ventures').update(patch).eq('id', id).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
