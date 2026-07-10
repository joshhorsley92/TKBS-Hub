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

  // The anti-double-count link: realizing against a FreshBooks invoice flips
  // the projection out of "potential" — the invoice's actual takes over.
  const updates: Record<string, unknown> = { status };
  if (body?.realized_by_fb_invoice_id != null) {
    updates.realized_by_fb_invoice_id = Number(body.realized_by_fb_invoice_id);
    updates.status = 'realized';
  }
  if (body?.realized_note) updates.realized_note = String(body.realized_note);

  const { error } = await auth.supabase.from('money_lines').update(updates).eq('id', id);
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
