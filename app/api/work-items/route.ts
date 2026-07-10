import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// POST /api/work-items — "I'm now working on X".
// Social contract: one 'now' per person — previous 'now' items flip to done.
// Also drops a manual work_log row so the change shows in the feed.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const title = (body?.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { supabase, userId, name } = auth;

  // Close out this person's current 'now' items.
  await supabase
    .from('work_items')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .eq('status', 'now');

  const { data: item, error } = await supabase
    .from('work_items')
    .insert({
      profile_id: userId,
      title,
      note: body?.note ?? null,
      repo_id: body?.repo_id ?? null,
      client_id: body?.client_id ?? null,
      status: 'now',
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Feed visibility (manual rows have no external_id — always inserts).
  await supabase.from('work_log').insert({
    source: 'manual',
    kind: 'note',
    actor_id: userId,
    title: `▸ now: ${title}`,
    payload: { work_item_id: item.id },
  });

  return NextResponse.json({ ok: true, id: item.id, by: name });
}
