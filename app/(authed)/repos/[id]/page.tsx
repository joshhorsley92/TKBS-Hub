import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeQuery } from '@/lib/data';
import { DASH, ago, fmtY, num, tme } from '@/lib/broadsheet';
import { Chip, EmptyState, SHead } from '@/components/broadsheet/primitives';
import { SummarizeButton } from '@/components/broadsheet/builds/SummarizeButton';

export const dynamic = 'force-dynamic';

// A repo, up close: the raw commit log and the AI summary distilled from it.
//
// Builds is the board; this is the evidence underneath one. It has no nav item
// of its own — you arrive here from a build's activity river, or from the
// unmapped-repo list on Builds. Every line on this page is an ingested commit.

type RepoRow = {
  id: string;
  org: string;
  name: string;
  purpose: string | null;
  category: string;
  local_path: string | null;
  default_branch: string;
  last_synced_at: string | null;
  open_pr_count: number | null;
  open_issue_count: number | null;
  sync_error: string | null;
  work_summary: string | null;
  work_summary_at: string | null;
  venture_id: string | null;
  ventures: { id: string; name: string } | { id: string; name: string }[] | null;
};

type Commit = {
  id: string;
  occurred_at: string;
  title: string;
  actor_raw: string | null;
  payload: { sha?: string; url?: string; branch?: string } | null;
  profiles: { name: string } | null;
};

export default async function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const repo = await safeQuery<RepoRow>((s) =>
    s
      .from('repos')
      .select(
        'id, org, name, purpose, category, local_path, default_branch, last_synced_at, open_pr_count, open_issue_count, sync_error, work_summary, work_summary_at, venture_id, ventures:venture_id(id, name)',
      )
      .eq('id', id)
      .single(),
  );
  if (!repo) notFound();

  const commits = await safeQuery<Commit[]>((s) =>
    s
      .from('work_log')
      .select('id, occurred_at, title, actor_raw, payload, profiles:actor_id (name)')
      .eq('repo_id', id)
      .eq('kind', 'commit')
      .order('occurred_at', { ascending: false })
      .limit(50)
      .returns<Commit[]>(),
  );

  // PostgREST embeds a many-to-one FK as an array when the client is untyped.
  const venture = Array.isArray(repo.ventures) ? (repo.ventures[0] ?? null) : repo.ventures;

  return (
    <>
      <Link href="/builds" className="backlink">
        ← Builds
      </Link>

      <div className="topline">
        <div>
          <div className="kicker">{repo.org}</div>
          <h1 className="h1">{repo.name}</h1>
          {repo.purpose && <p className="sub">{repo.purpose}</p>}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <Chip>{repo.category}</Chip>
            <Chip>{repo.default_branch}</Chip>
            {venture ? (
              <Chip tone="mint">
                <Link href={`/builds/${venture.id}`} style={{ color: 'inherit' }}>
                  {venture.name}
                </Link>
              </Chip>
            ) : (
              <Chip title="Its commits roll up to no build. Link it from a build's Repo activity panel.">
                no build
              </Chip>
            )}
            {repo.sync_error && <Chip tone="amber">sync error</Chip>}
          </div>
          {repo.sync_error && (
            <p className="smol" style={{ color: 'var(--danger)', marginTop: 8 }}>
              {repo.sync_error}
            </p>
          )}
        </div>

        <div className="stamp">
          <div>synced {ago(repo.last_synced_at)}</div>
          <div style={{ marginTop: 4 }}>
            {num(repo.open_pr_count)} PR · {num(repo.open_issue_count)} issues open
          </div>
          {repo.local_path && (
            <div style={{ marginTop: 4, opacity: 0.75 }} title={repo.local_path}>
              {repo.local_path}
            </div>
          )}
        </div>
      </div>

      <SHead
        title="Current work — AI summary"
        style={{ marginTop: 8 }}
        right={<SummarizeButton repoId={repo.id} hasSummary={Boolean(repo.work_summary)} />}
      />
      <div className="card pad">
        {repo.work_summary ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', textWrap: 'pretty' }}>
              {repo.work_summary}
            </p>
            <p className="smol" style={{ marginTop: 10 }}>
              Generated {ago(repo.work_summary_at)} from the commit history — regenerate after new
              work lands.
            </p>
          </>
        ) : (
          <EmptyState title="No summary yet.">
            The commits below are ingested and real; nothing has read them into prose. Summarize
            distils the recent history — it costs tokens, so it only runs when asked.
          </EmptyState>
        )}
      </div>

      <SHead
        title="Commit log"
        right={commits?.length ? <span className="sample">{commits.length} most recent</span> : undefined}
      />
      <div className="card pad">
        {!commits || commits.length === 0 ? (
          <EmptyState title="No commits ingested.">
            The GitHub sync hasn&rsquo;t landed any commits for this repo yet. The log stays empty
            rather than showing a placeholder.
          </EmptyState>
        ) : (
          <div className="river">
            {commits.map((c) => (
              <div key={c.id} className="ev">
                <span className="node2" />
                <span className="t">
                  {fmtY(c.occurred_at)} · {tme(c.occurred_at)}
                </span>
                <div className="body">
                  <b>
                    {c.payload?.url ? (
                      <a href={c.payload.url} target="_blank" rel="noreferrer">
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </b>
                  <div className="meta">
                    <span className="sample">{c.payload?.sha?.slice(0, 7) ?? DASH}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {c.profiles?.name ?? c.actor_raw ?? 'unknown author'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
