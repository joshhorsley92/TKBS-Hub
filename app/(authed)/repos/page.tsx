import Link from 'next/link';
import { Panel, EmptyState } from '@/components/console/Panel';
import { SyncButton } from '@/components/console/SyncButton';
import { safeQuery, isDbConfigured } from '@/lib/data';
import { age, isStale } from '@/lib/format';

type RepoRow = {
  id: string;
  org: string;
  name: string;
  provider: string;
  category: string;
  purpose: string | null;
  last_commit_at: string | null;
  last_commit_author: string | null;
  last_commit_message: string | null;
  open_pr_count: number | null;
  open_issue_count: number | null;
  sync_error: string | null;
  is_active: boolean;
};

export default async function ReposPage() {
  const repos = await safeQuery<RepoRow[]>((s) =>
    s
      .from('repos')
      .select(
        'id, org, name, provider, category, purpose, last_commit_at, last_commit_author, last_commit_message, open_pr_count, open_issue_count, sync_error, is_active',
      )
      .order('last_commit_at', { ascending: false, nullsFirst: false }),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Repos</h1>
          <p className="font-mono text-[11px] text-ink-4">
            {repos ? `${repos.length} tracked · ${repos.filter((r) => r.is_active).length} syncing` : 'status board'}
          </p>
        </div>
        <SyncButton />
      </div>

      <Panel label="Repo status board">
        {!repos ? (
          <EmptyState>
            {isDbConfigured() ? 'NO DATA — RUN SYNC' : 'DB NOT CONNECTED — see supabase/README.md'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="console-table font-mono">
              <thead>
                <tr>
                  <th>Repo</th>
                  <th>Last commit</th>
                  <th>By</th>
                  <th>Age</th>
                  <th>PR</th>
                  <th>Iss</th>
                  <th>Cat</th>
                  <th>Sync</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/repos/${r.id}`} className="text-ink transition hover:text-mint">
                        {r.name}
                      </Link>
                      <span className="ml-1.5 text-[10px] text-ink-5">{r.org}</span>
                    </td>
                    <td className="max-w-[320px] truncate" title={r.last_commit_message ?? undefined}>
                      {r.last_commit_message ?? '—'}
                    </td>
                    <td className={r.last_commit_author?.toLowerCase().includes('josh') ? 'text-commit-2' : 'text-mint'}>
                      {r.last_commit_author ? r.last_commit_author.split(' ')[0].toUpperCase() : '—'}
                    </td>
                    <td className={isStale(r.last_commit_at) ? 'text-warn' : undefined}>
                      {age(r.last_commit_at)}
                    </td>
                    <td>{r.open_pr_count ?? '—'}</td>
                    <td>{r.open_issue_count ?? '—'}</td>
                    <td className="text-ink-4">{r.category}</td>
                    <td>
                      {!r.is_active ? (
                        <span className="text-ink-5" title="excluded from sync">off</span>
                      ) : r.sync_error ? (
                        <span className="text-danger" title={r.sync_error}>err</span>
                      ) : (
                        <span className="text-actual">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
