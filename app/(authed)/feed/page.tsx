import Link from 'next/link';
import { Panel, EmptyState } from '@/components/console/Panel';
import { NowForm } from '@/components/console/NowForm';
import { safeQuery, isDbConfigured } from '@/lib/data';
import { logStamp } from '@/lib/format';

type LogRow = {
  id: string;
  source: string;
  kind: string;
  occurred_at: string;
  title: string;
  actor_raw: string | null;
  payload: { url?: string } | null;
  repos: { id: string; name: string } | null;
  profiles: { name: string } | null;
};

const SRC_COLOR: Record<string, string> = {
  git: 'text-actual',
  freshbooks: 'text-commit-2',
  manual: 'text-pot',
  other: 'text-ink-4',
};

const FILTERS = [
  { key: '', label: 'ALL' },
  { key: 'git', label: 'GIT' },
  { key: 'freshbooks', label: 'FBK' },
  { key: 'manual', label: 'HUB' },
] as const;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; who?: string }>;
}) {
  const { src, who } = await searchParams;

  const profiles = await safeQuery<{ id: string; name: string }[]>((s) =>
    s.from('profiles').select('id, name').order('name'),
  );

  const log = await safeQuery<LogRow[]>((s) => {
    let q = s
      .from('work_log')
      .select('id, source, kind, occurred_at, title, actor_raw, payload, repos:repo_id (id, name), profiles:actor_id (name)')
      .order('occurred_at', { ascending: false })
      .limit(100);
    if (src) q = q.eq('source', src);
    if (who) q = q.eq('actor_id', who);
    return q.returns<LogRow[]>();
  });

  const filterHref = (nextSrc?: string, nextWho?: string) => {
    const p = new URLSearchParams();
    if (nextSrc) p.set('src', nextSrc);
    if (nextWho) p.set('who', nextWho);
    const qs = p.toString();
    return qs ? `/feed?${qs}` : '/feed';
  };

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-lg font-bold">Feed</h1>
        <p className="font-mono text-[11px] text-ink-4">every commit, money event, and status change — one log</p>
      </div>

      <div className="mb-3">
        <NowForm />
      </div>

      <Panel
        label="Event log"
        action={
          <span className="flex items-center gap-1 font-mono text-[10px]">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key || undefined, who)}
                className={`rounded-console px-2 py-0.5 tracking-wider transition ${
                  (src ?? '') === f.key ? 'bg-panel-2 text-mint' : 'text-ink-4 hover:text-ink-2'
                }`}
              >
                {f.label}
              </Link>
            ))}
            <span className="mx-1 text-edge">|</span>
            <Link
              href={filterHref(src, undefined)}
              className={`rounded-console px-2 py-0.5 tracking-wider transition ${!who ? 'bg-panel-2 text-mint' : 'text-ink-4 hover:text-ink-2'}`}
            >
              BOTH
            </Link>
            {(profiles ?? []).map((p) => (
              <Link
                key={p.id}
                href={filterHref(src, p.id)}
                className={`rounded-console px-2 py-0.5 tracking-wider transition ${
                  who === p.id ? 'bg-panel-2 text-mint' : 'text-ink-4 hover:text-ink-2'
                }`}
              >
                {p.name.split(' ')[0].toUpperCase()}
              </Link>
            ))}
          </span>
        }
      >
        {!log || log.length === 0 ? (
          <EmptyState>
            {isDbConfigured() ? 'NOTHING HERE YET — SYNC REPOS OR LOG WHAT YOU ARE ON' : 'DB NOT CONNECTED'}
          </EmptyState>
        ) : (
          <div className="font-mono">
            {log.map((l) => (
              <div key={l.id} className="flex items-baseline gap-2.5 border-b border-edge-2 py-[5.5px] text-[11.5px] last:border-b-0">
                <span className="w-[42px] shrink-0 text-ink-5">{logStamp(l.occurred_at)}</span>
                <span className={`w-[30px] shrink-0 text-[10px] font-bold tracking-wider ${SRC_COLOR[l.source] ?? 'text-ink-4'}`}>
                  {l.source === 'freshbooks' ? 'FBK' : l.source === 'manual' ? 'HUB' : l.source.slice(0, 3).toUpperCase()}
                </span>
                {l.repos && (
                  <Link href={`/repos/${l.repos.id}`} className="shrink-0 text-[10.5px] text-ink-4 transition hover:text-mint">
                    {l.repos.name}
                  </Link>
                )}
                <span className="min-w-0 flex-1 truncate text-ink-2" title={l.title}>
                  {l.payload?.url ? (
                    <a href={l.payload.url} target="_blank" rel="noreferrer" className="transition hover:text-mint">
                      {l.title}
                    </a>
                  ) : (
                    l.title
                  )}
                </span>
                <span className={`shrink-0 text-[10px] ${l.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : l.profiles ? 'text-mint' : 'text-ink-5'}`}>
                  {(l.profiles?.name ?? l.actor_raw ?? '').split(' ')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
