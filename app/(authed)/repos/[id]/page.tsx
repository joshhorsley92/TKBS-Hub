import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Panel, EmptyState } from '@/components/console/Panel';
import { safeQuery } from '@/lib/data';
import { age, logStamp } from '@/lib/format';

type Commit = {
  id: string;
  occurred_at: string;
  title: string;
  actor_raw: string | null;
  payload: { sha?: string; url?: string; branch?: string };
  profiles: { name: string } | null;
};

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const repo = await safeQuery<{
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
  }>((s) =>
    s
      .from('repos')
      .select('id, org, name, purpose, category, local_path, default_branch, last_synced_at, open_pr_count, open_issue_count, sync_error')
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

  return (
    <div>
      <Link href="/repos" className="mb-3 flex w-fit items-center gap-1.5 font-mono text-[11px] text-ink-4 transition hover:text-ink-2">
        <ArrowLeft size={12} /> REPO BOARD
      </Link>

      <div className="mb-3">
        <h1 className="text-lg font-bold">
          {repo.name} <span className="text-sm font-normal text-ink-4">{repo.org}</span>
        </h1>
        <p className="font-mono text-[11px] text-ink-4">
          {repo.category} · {repo.default_branch}
          {repo.local_path ? ` · ${repo.local_path}` : ''} · synced {age(repo.last_synced_at)} ago
          {repo.open_pr_count != null ? ` · ${repo.open_pr_count} PR / ${repo.open_issue_count} issues open` : ''}
        </p>
        {repo.purpose && <p className="mt-1 max-w-[80ch] text-[12.5px] text-ink-3">{repo.purpose}</p>}
        {repo.sync_error && (
          <p className="mt-1 font-mono text-[11px] text-danger">sync error: {repo.sync_error}</p>
        )}
      </div>

      <Panel label="Commit log">
        {!commits || commits.length === 0 ? (
          <EmptyState>NO COMMITS INGESTED — RUN SYNC</EmptyState>
        ) : (
          <div className="font-mono">
            {commits.map((c) => (
              <div key={c.id} className="flex items-baseline gap-2.5 border-b border-edge-2 py-[5.5px] text-[11.5px] last:border-b-0">
                <span className="w-[42px] shrink-0 text-ink-5">{logStamp(c.occurred_at)}</span>
                <span className="shrink-0 text-[10px] text-ink-5">{c.payload?.sha?.slice(0, 7) ?? ''}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2" title={c.title}>
                  {c.payload?.url ? (
                    <a href={c.payload.url} target="_blank" rel="noreferrer" className="transition hover:text-mint">
                      {c.title}
                    </a>
                  ) : (
                    c.title
                  )}
                </span>
                <span className={`shrink-0 text-[10px] ${c.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : 'text-mint'}`}>
                  {(c.profiles?.name ?? c.actor_raw ?? 'unknown').split(' ')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
