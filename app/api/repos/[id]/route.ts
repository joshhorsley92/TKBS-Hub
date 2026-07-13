import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const CATEGORIES = ['client', 'product', 'internal', 'infra', 'content'];

// Edit a repo's mapping. This is the seam the whole hub hangs on: setting
// venture_id is what makes a repo's real commits roll up into a build, and
// client_id is what makes them land on a client's life-line. Until a repo is
// mapped, its commits are real but they belong to nothing — which is why the
// Builds board can show four ventures and no repo activity at once.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  // Empty string / null both mean "unmap it" — a repo with no build is a normal,
  // honest state, not an error.
  if ('venture_id' in body) patch.venture_id = body.venture_id || null;
  if ('client_id' in body) patch.client_id = body.client_id || null;
  if (CATEGORIES.includes(body.category)) patch.category = body.category;
  if (typeof body.purpose === 'string') patch.purpose = body.purpose.trim() || null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('repos').update(patch).eq('id', id).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
