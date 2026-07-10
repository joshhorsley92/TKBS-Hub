import { createServiceRoleClient } from '@/lib/supabase/server';

// GitHub poller — idempotent by construction:
//   1. conditional GET with the stored etag (304 → skip repo entirely)
//   2. upsert commits into work_log ON CONFLICT (source, external_id) DO NOTHING
//   3. only after inserts land, advance the repo cache columns
// A crash mid-run re-processes commits harmlessly on the next poll.

const GH = 'https://api.github.com';

type RepoRow = {
  id: string;
  org: string;
  name: string;
  default_branch: string;
  sync_etag: string | null;
};

type SyncStats = {
  repos_checked: number;
  repos_updated: number;
  repos_unchanged: number;
  commits_seen: number;
  errors: string[];
};

// Token resolution: fine-grained PATs are scoped to one resource owner, so a
// per-org token (GITHUB_PAT_TKBS_SUPPORT, GITHUB_PAT_JOSHHORSLEY92) wins over
// the generic GITHUB_PAT. A single classic PAT with `repo` scope also works
// via GITHUB_PAT alone.
export function tokenForOrg(org: string): string | undefined {
  const key = `GITHUB_PAT_${org.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] || process.env.GITHUB_PAT;
}

function ghHeaders(org: string, etag?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // No token for this org → go unauthenticated (public repos still work at
  // 60 req/hr; private ones 404 and surface as per-repo sync errors).
  const token = tokenForOrg(org);
  if (token) h.Authorization = `Bearer ${token}`;
  if (etag) h['If-None-Match'] = etag;
  return h;
}

export async function syncGithub(): Promise<SyncStats> {
  const anyToken = Object.keys(process.env).some((k) => k.startsWith('GITHUB_PAT') && process.env[k]);
  if (!anyToken) {
    throw new Error('No GitHub token set — add GITHUB_PAT (or per-org GITHUB_PAT_*) to .env.local');
  }

  const supabase = createServiceRoleClient();
  const stats: SyncStats = {
    repos_checked: 0,
    repos_updated: 0,
    repos_unchanged: 0,
    commits_seen: 0,
    errors: [],
  };

  // Identity map: git author email → profile id (the person discriminator —
  // both people commit under the shared joshhorsley92 GitHub account).
  const { data: identities } = await supabase
    .from('identities')
    .select('profile_id, kind, value');
  const byEmail = new Map<string, string>(
    (identities ?? [])
      .filter((i) => i.kind === 'git_email')
      .map((i) => [i.value.toLowerCase(), i.profile_id]),
  );

  const { data: repos } = await supabase
    .from('repos')
    .select('id, org, name, default_branch, sync_etag')
    .eq('provider', 'github')
    .eq('is_active', true);

  for (const repo of (repos ?? []) as RepoRow[]) {
    stats.repos_checked++;
    try {
      const updated = await syncRepo(supabase, repo, byEmail, stats);
      if (updated) stats.repos_updated++;
      else stats.repos_unchanged++;
    } catch (e) {
      const msg = `${repo.org}/${repo.name}: ${e instanceof Error ? e.message : String(e)}`;
      stats.errors.push(msg);
      await supabase
        .from('repos')
        .update({ sync_error: msg, last_synced_at: new Date().toISOString() })
        .eq('id', repo.id);
    }
  }

  return stats;
}

async function syncRepo(
  supabase: ReturnType<typeof createServiceRoleClient>,
  repo: RepoRow,
  byEmail: Map<string, string>,
  stats: SyncStats,
): Promise<boolean> {
  const base = `${GH}/repos/${repo.org}/${repo.name}`;

  // 1. Repo metadata with etag — 304 means nothing changed since last poll.
  const metaRes = await fetch(base, { headers: ghHeaders(repo.org, repo.sync_etag), cache: 'no-store' });
  if (metaRes.status === 304) {
    await supabase
      .from('repos')
      .update({ last_synced_at: new Date().toISOString(), sync_error: null })
      .eq('id', repo.id);
    return false;
  }
  if (!metaRes.ok) throw new Error(`GET repo → HTTP ${metaRes.status}`);
  const meta = await metaRes.json();
  const etag = metaRes.headers.get('etag');
  const branch: string = meta.default_branch || repo.default_branch;

  // 2. Recent commits on the default branch.
  const commitsRes = await fetch(
    `${base}/commits?sha=${encodeURIComponent(branch)}&per_page=50`,
    { headers: ghHeaders(repo.org), cache: 'no-store' },
  );
  // 409 = empty repository (no commits yet) — a real state, not an error.
  if (!commitsRes.ok && commitsRes.status !== 409) {
    throw new Error(`GET commits → HTTP ${commitsRes.status}`);
  }
  const commits: Array<{
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author: { name?: string; email?: string; date?: string };
    };
  }> = commitsRes.status === 409 ? [] : await commitsRes.json();
  stats.commits_seen += commits.length;

  // 3. Idempotent ingest — replayable from scratch, dupes are no-ops.
  if (commits.length > 0) {
    const rows = commits.map((c) => {
      const email = (c.commit.author?.email ?? '').toLowerCase();
      return {
        source: 'git' as const,
        external_id: `${repo.org}/${repo.name}@${c.sha}`,
        kind: 'commit',
        occurred_at: c.commit.author?.date ?? new Date().toISOString(),
        actor_id: byEmail.get(email) ?? null,
        actor_raw: `${c.commit.author?.name ?? 'unknown'} <${email}>`,
        title: c.commit.message.split('\n')[0].slice(0, 300),
        repo_id: repo.id,
        payload: { sha: c.sha, url: c.html_url, branch },
      };
    });
    const { error } = await supabase
      .from('work_log')
      .upsert(rows, { onConflict: 'source,external_id', ignoreDuplicates: true });
    if (error) throw new Error(`work_log upsert: ${error.message}`);
  }

  // 4. Open PR / issue counts (issues list includes PRs — subtract them).
  const [prsRes, issuesRes] = await Promise.all([
    fetch(`${base}/pulls?state=open&per_page=100`, { headers: ghHeaders(repo.org), cache: 'no-store' }),
    fetch(`${base}/issues?state=open&per_page=100`, { headers: ghHeaders(repo.org), cache: 'no-store' }),
  ]);
  const prs = prsRes.ok ? ((await prsRes.json()) as unknown[]) : [];
  const issuesRaw = issuesRes.ok
    ? ((await issuesRes.json()) as Array<{ pull_request?: unknown }>)
    : [];
  const issues = issuesRaw.filter((i) => !i.pull_request);

  // 5. Only now advance the bookmark/cache (crash-safe ordering).
  const latest = commits[0];
  const { error: updErr } = await supabase
    .from('repos')
    .update({
      default_branch: branch,
      last_commit_sha: latest?.sha ?? null,
      last_commit_at: latest?.commit.author?.date ?? null,
      last_commit_author: latest?.commit.author?.name ?? null,
      last_commit_message: latest?.commit.message.split('\n')[0].slice(0, 300) ?? null,
      open_pr_count: prs.length,
      open_issue_count: issues.length,
      sync_etag: etag,
      sync_error: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', repo.id);
  if (updErr) throw new Error(`repo cache update: ${updErr.message}`);

  return true;
}
