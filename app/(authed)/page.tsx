import Link from 'next/link';
import { Panel, EmptyState } from '@/components/console/Panel';
import { Avatar } from '@/components/console/Avatar';
import { SyncButton } from '@/components/console/SyncButton';
import { safeQuery, isDbConfigured } from '@/lib/data';
import { age, isStale, logStamp } from '@/lib/format';

// Cockpit — status-first by design decision (2026-07-10): current state of
// clients and internal work leads; money is a single compact line at the
// bottom that links to /money. Never fabricates: unknowns render as unknowns.

type Profile = { id: string; name: string; role: string };
type WorkItem = { id: string; title: string; note: string | null; profile_id: string; started_at: string };
type ClientRow = { id: string; name: string; stage: string; health: string | null; updated_at: string };
type RepoRow = { id: string; name: string; last_commit_at: string | null; last_commit_author: string | null; last_commit_message: string | null; is_active: boolean };
type LogRow = { id: string; source: string; kind: string; occurred_at: string; title: string; actor_raw: string | null; profiles: { name: string } | null };

const STAGE_COLOR: Record<string, string> = {
  prospect: 'text-ink-4',
  discovery: 'text-commit-2',
  proposal: 'text-commit-2',
  active: 'text-actual',
  paused: 'text-warn',
  past: 'text-ink-5',
};

const SRC_COLOR: Record<string, string> = {
  git: 'text-actual',
  freshbooks: 'text-commit-2',
  manual: 'text-pot',
  other: 'text-ink-4',
};

export default async function CockpitPage() {
  const [profiles, nowItems, clients, repos, log] = await Promise.all([
    safeQuery<Profile[]>((s) => s.from('profiles').select('id, name, role').order('role')),
    safeQuery<WorkItem[]>((s) =>
      s.from('work_items').select('id, title, note, profile_id, started_at').eq('status', 'now').order('started_at', { ascending: false }),
    ),
    safeQuery<ClientRow[]>((s) =>
      s.from('clients').select('id, name, stage, health, updated_at').neq('stage', 'past').order('updated_at', { ascending: false }),
    ),
    safeQuery<RepoRow[]>((s) =>
      s
        .from('repos')
        .select('id, name, last_commit_at, last_commit_author, last_commit_message, is_active')
        .eq('is_active', true)
        .order('last_commit_at', { ascending: false, nullsFirst: false })
        .limit(6),
    ),
    safeQuery<LogRow[]>((s) =>
      s
        .from('work_log')
        .select('id, source, kind, occurred_at, title, actor_raw, profiles:actor_id (name)')
        .order('occurred_at', { ascending: false })
        .limit(9)
        .returns<LogRow[]>(),
    ),
  ]);

  const dbUp = isDbConfigured();

  return (
    <div>
      {/* ── Now strip: what each person is on ─────────────────────────── */}
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        {(profiles && profiles.length > 0 ? profiles : [
          { id: 'joe', name: 'Joe', role: 'engineer' },
          { id: 'josh', name: 'Josh', role: 'owner' },
        ]).map((p) => {
          const item = nowItems?.find((w) => w.profile_id === p.id);
          const accent = p.role === 'owner' ? 'border-l-commit' : 'border-l-mint';
          const nameColor = p.role === 'owner' ? 'text-commit-2' : 'text-mint';
          return (
            <div key={p.id} className={`flex items-center gap-2.5 rounded-console border border-edge border-l-2 ${accent} bg-panel px-4 py-2.5`}>
              <Avatar name={p.name} role={p.role} />
              <div className="min-w-0">
                <span className={`font-heading text-[11px] font-bold tracking-[.1em] ${nameColor}`}>
                  {p.name.split(' ')[0].toUpperCase()} ▸
                </span>{' '}
                <span className="text-[12px] text-ink-3">
                  {item ? item.title : dbUp ? 'nothing logged — set it on /feed' : 'unknown (db not connected)'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Status boards: clients + internal work, first and foremost ── */}
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <Panel label="Client status">
          {!clients ? (
            <EmptyState>{dbUp ? 'NO CLIENTS' : 'DB NOT CONNECTED'}</EmptyState>
          ) : (
            <table className="console-table font-mono">
              <thead>
                <tr><th>Client</th><th>Stage</th><th>Health</th><th>Touched</th></tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="text-ink transition hover:text-mint">{c.name}</Link>
                    </td>
                    <td className={STAGE_COLOR[c.stage] ?? ''}>{c.stage.toUpperCase()}</td>
                    <td>
                      {c.health ? (
                        <span className={c.health === 'green' ? 'text-actual' : c.health === 'yellow' ? 'text-warn' : 'text-danger'}>
                          ● {c.health}
                        </span>
                      ) : (
                        <span className="text-ink-5">not set</span>
                      )}
                    </td>
                    <td className="text-ink-4">{age(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          label="Internal work — repos"
          action={<SyncButton />}
        >
          {!repos ? (
            <EmptyState>{dbUp ? 'NO DATA — RUN SYNC' : 'DB NOT CONNECTED'}</EmptyState>
          ) : (
            <table className="console-table font-mono">
              <thead>
                <tr><th>Repo</th><th>Last commit</th><th>By</th><th>Age</th></tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/repos/${r.id}`} className="text-ink transition hover:text-mint">{r.name}</Link>
                    </td>
                    <td className="max-w-[220px] truncate" title={r.last_commit_message ?? undefined}>
                      {r.last_commit_message ?? '—'}
                    </td>
                    <td className={r.last_commit_author?.toLowerCase().includes('josh') ? 'text-commit-2' : 'text-mint'}>
                      {r.last_commit_author ? r.last_commit_author.split(' ')[0].toUpperCase() : '—'}
                    </td>
                    <td className={isStale(r.last_commit_at) ? 'text-warn' : 'text-ink-4'}>
                      {age(r.last_commit_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* ── Event log ──────────────────────────────────────────────────── */}
      <Panel label="Event log" className="mt-3">
        {!log || log.length === 0 ? (
          <EmptyState>{dbUp ? 'NO EVENTS YET — SYNC OR LOG SOMETHING' : 'DB NOT CONNECTED'}</EmptyState>
        ) : (
          <div className="font-mono">
            {log.map((l) => (
              <div key={l.id} className="flex items-baseline gap-2.5 border-b border-edge-2 py-[5.5px] text-[11.5px] last:border-b-0">
                <span className="w-[42px] shrink-0 text-ink-5">{logStamp(l.occurred_at)}</span>
                <span className={`w-[30px] shrink-0 text-[10px] font-bold tracking-wider ${SRC_COLOR[l.source] ?? 'text-ink-4'}`}>
                  {l.source === 'freshbooks' ? 'FBK' : l.source.slice(0, 3).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-2" title={l.title}>{l.title}</span>
                <span className={`shrink-0 text-[10px] ${l.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : l.profiles ? 'text-mint' : 'text-ink-5'}`}>
                  {(l.profiles?.name ?? l.actor_raw ?? '').split(' ')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Money: one compact, honest line — detail lives on /money ───── */}
      <Link
        href="/money"
        className="mt-3 flex items-center gap-4 rounded-console border border-edge bg-panel px-4 py-2 font-mono text-[11px] text-ink-4 transition hover:border-mint/40"
      >
        <span className="p-label">Money</span>
        <span>not tracked yet — FreshBooks lands in Phase 2, planning ledger on /money</span>
        <span className="ml-auto text-ink-5">→</span>
      </Link>
    </div>
  );
}
