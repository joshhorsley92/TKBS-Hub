import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// The reuse map: an internal build (a venture) deployed to — or a candidate
// for — a client. This is the thread the whole hub is organised around: cost is
// incurred once, value compounds per reuse.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const ventureId = body?.venture_id;
  const clientId = body?.client_id;
  if (!ventureId || !clientId) {
    return NextResponse.json({ error: 'venture_id and client_id are required' }, { status: 400 });
  }

  const status = body?.status === 'candidate' ? 'candidate' : 'deployed';

  const { error } = await supabase.from('build_deployments').upsert(
    {
      venture_id: ventureId,
      client_id: clientId,
      status,
      role: body?.role?.trim() || null,
      // Only a deployment has a "since"; a candidate hasn't happened yet.
      since: status === 'deployed' ? (body?.since || new Date().toISOString().slice(0, 10)) : null,
    },
    { onConflict: 'venture_id,client_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ventureId = searchParams.get('venture_id');
  const clientId = searchParams.get('client_id');
  if (!ventureId || !clientId) {
    return NextResponse.json({ error: 'venture_id and client_id are required' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('build_deployments')
    .delete()
    .eq('venture_id', ventureId)
    .eq('client_id', clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
