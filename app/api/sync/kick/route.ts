import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isFreshbooksConnected } from '@/lib/freshbooks';

const STALE_MINUTES = 15;

// POST /api/sync/kick — the cockpit's lazy freshness mechanism: if a source
// hasn't synced in STALE_MINUTES, trigger its sync. Fire-and-forget from the
// client; zero scheduler infrastructure, always fresh when looked at.
export async function POST(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const origin = new URL(request.url).origin;
  const kicked: string[] = [];

  // Stale check per job via the most recent successful run.
  async function lastRun(job: string): Promise<string | null> {
    const { data } = await supabase
      .from('ingest_runs')
      .select('finished_at')
      .eq('job', job)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.finished_at ?? null;
  }

  const headers: HeadersInit = { 'x-sync-secret': process.env.SYNC_SECRET ?? '' };

  const ghLast = await lastRun('github_poll');
  if (!ghLast || ghLast < cutoff) {
    kicked.push('github');
    // fire-and-forget — don't block the page on a full poll
    fetch(`${origin}/api/sync/github`, { method: 'POST', headers }).catch(() => {});
  }

  if (await isFreshbooksConnected()) {
    const fbLast = await lastRun('freshbooks_sync');
    if (!fbLast || fbLast < cutoff) {
      kicked.push('freshbooks');
      fetch(`${origin}/api/sync/freshbooks`, { method: 'POST', headers }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, kicked });
}
