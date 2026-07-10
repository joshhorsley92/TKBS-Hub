import { createServiceRoleClient } from '@/lib/supabase/server';

// Composes the standup-style daily digest: last 24h of hub activity grouped
// by person, plus current "now" items. Honest by construction — sections with
// nothing to say are omitted, never padded.

type LogRow = {
  source: string;
  kind: string;
  title: string;
  occurred_at: string;
  actor_id: string | null;
  repos: { name: string } | null;
};

export async function composeDigest(): Promise<{ text: string; hasContent: boolean }> {
  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [{ data: profiles }, { data: log }, { data: nowItems }] = await Promise.all([
    supabase.from('profiles').select('id, name, role'),
    supabase
      .from('work_log')
      .select('source, kind, title, occurred_at, actor_id, repos:repo_id (name)')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(200)
      .returns<LogRow[]>(),
    supabase.from('work_items').select('profile_id, title').eq('status', 'now'),
  ]);

  const lines: string[] = [];
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  lines.push(`*TKBS Hub — daily digest · ${day}*`);

  let hasContent = false;

  for (const p of profiles ?? []) {
    const first = p.name.split(' ')[0];
    const mine = (log ?? []).filter((l) => l.actor_id === p.id);
    const commits = mine.filter((l) => l.kind === 'commit');
    // "▸ now:" log rows duplicate the live now-item shown below — skip them.
    const other = mine.filter((l) => l.kind !== 'commit' && !l.title.startsWith('▸ now:'));
    const now = (nowItems ?? []).find((w) => w.profile_id === p.id);

    const parts: string[] = [];
    if (commits.length) {
      const repoNames = [...new Set(commits.map((c) => c.repos?.name).filter(Boolean))];
      parts.push(`${commits.length} commit${commits.length > 1 ? 's' : ''} across ${repoNames.length} repo${repoNames.length > 1 ? 's' : ''} (${repoNames.slice(0, 4).join(', ')})`);
    }
    for (const o of other.slice(0, 4)) parts.push(o.title);
    if (now) parts.push(`now on: ${now.title}`);

    if (parts.length) {
      hasContent = true;
      lines.push(`\n*${first}:*`);
      for (const part of parts) lines.push(`  •  ${part}`);
    }
  }

  // Unattributed activity (e.g. commits from unmapped authors)
  const unattributed = (log ?? []).filter((l) => !l.actor_id);
  if (unattributed.length) {
    hasContent = true;
    lines.push(`\n_${unattributed.length} unattributed event${unattributed.length > 1 ? 's' : ''} (unmapped git author?)_`);
  }

  if (!hasContent) {
    lines.push('\n_No hub activity in the last 24 hours._');
  }

  return { text: lines.join('\n'), hasContent };
}

export async function postToSlack(text: string): Promise<{ ok: boolean; status: number }> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) throw new Error('SLACK_WEBHOOK_URL is not set');
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { ok: res.ok, status: res.status };
}
