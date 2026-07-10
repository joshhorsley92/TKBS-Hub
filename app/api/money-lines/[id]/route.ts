import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// PATCH — cancel/reopen a line (soft state, keeps history).
// DELETE — hard-remove a mistyped line.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!['open', 'realized', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'status must be open|realized|cancelled' }, { status: 400 });
  }

  const { error } = await auth.supabase.from('money_lines').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await auth.supabase.from('money_lines').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
