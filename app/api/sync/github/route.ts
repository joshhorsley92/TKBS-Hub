import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { syncGithub } from '@/lib/github';

export const maxDuration = 120;

// POST /api/sync/github — polls all active GitHub repos.
// Auth: logged-in user OR x-sync-secret header (future cron caller).
export async function POST(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { data: run } = await supabase
    .from('ingest_runs')
    .insert({ job: 'github_poll', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();

  try {
    const stats = await syncGithub();
    await supabase
      .from('ingest_runs')
      .update({
        status: stats.errors.length === 0 ? 'succeeded' : 'failed',
        finished_at: new Date().toISOString(),
        stats,
        error: stats.errors.length ? stats.errors.join('; ') : null,
      })
      .eq('id', run?.id ?? '');
    return NextResponse.json({ ok: stats.errors.length === 0, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('ingest_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error: msg })
      .eq('id', run?.id ?? '');
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
