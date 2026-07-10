import { Panel, EmptyState } from '@/components/console/Panel';
import { FreshbooksSyncButton } from '@/components/console/FreshbooksSyncButton';
import { isFreshbooksConnected } from '@/lib/freshbooks';
import { safeQuery } from '@/lib/data';
import { age, logStamp } from '@/lib/format';

type IngestRun = {
  id: string;
  job: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  created_at: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ fb?: string; fb_msg?: string }>;
}) {
  const { fb, fb_msg } = await searchParams;

  const fbConfigured = !!process.env.FRESHBOOKS_CLIENT_ID && !!process.env.FRESHBOOKS_CLIENT_SECRET;
  let fbConnected = false;
  try {
    fbConnected = await isFreshbooksConnected();
  } catch {
    /* db not up */
  }

  const [runs, identities, assumptions] = await Promise.all([
    safeQuery<IngestRun[]>((s) =>
      s.from('ingest_runs').select('*').order('created_at', { ascending: false }).limit(10),
    ),
    safeQuery<{ kind: string; value: string; profiles: { name: string } | null }[]>((s) =>
      s.from('identities').select('kind, value, profiles:profile_id (name)').returns<
        { kind: string; value: string; profiles: { name: string } | null }[]
      >(),
    ),
    safeQuery<{ key: string; value: unknown; note: string | null }[]>((s) =>
      s.from('assumptions').select('key, value, note').order('key'),
    ),
  ]);

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-lg font-bold">Settings</h1>
        <p className="font-mono text-[11px] text-ink-4">integrations · identities · planning assumptions</p>
      </div>

      <Panel label="FreshBooks" className="mb-3">
        {fb === 'connected' && (
          <p className="mb-2 font-mono text-[11px] text-actual">● connected successfully</p>
        )}
        {fb === 'error' && (
          <p className="mb-2 font-mono text-[11px] text-danger">connect failed: {fb_msg}</p>
        )}
        <div className="flex items-center gap-3 font-mono text-[11.5px]">
          {!fbConfigured ? (
            <span className="text-warn">
              ⚠ app not configured — set FRESHBOOKS_CLIENT_ID / FRESHBOOKS_CLIENT_SECRET in .env.local
              (register at my.freshbooks.com/#/developer, redirect URI http://localhost:3000/api/freshbooks/callback)
            </span>
          ) : fbConnected ? (
            <>
              <span className="text-actual">● CONNECTED</span>
              <FreshbooksSyncButton />
            </>
          ) : (
            <a
              href="/api/freshbooks/connect"
              className="rounded-console border border-edge bg-panel-2 px-3 py-1.5 text-[11px] tracking-wider text-ink-3 transition hover:border-mint hover:text-mint"
            >
              CONNECT FRESHBOOKS →
            </a>
          )}
        </div>
      </Panel>

      <Panel label="Sync health" className="mb-3">
        {!runs || runs.length === 0 ? (
          <EmptyState>NO SYNC RUNS YET</EmptyState>
        ) : (
          <table className="console-table font-mono">
            <thead>
              <tr><th>When</th><th>Job</th><th>Status</th><th>Stats</th><th>Error</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="text-ink-4">{logStamp(r.created_at)}</td>
                  <td>{r.job}</td>
                  <td className={r.status === 'succeeded' ? 'text-actual' : r.status === 'failed' ? 'text-danger' : 'text-warn'}>
                    {r.status}
                  </td>
                  <td className="max-w-[380px] truncate text-ink-4" title={JSON.stringify(r.stats)}>
                    {Object.entries(r.stats ?? {})
                      .filter(([k]) => k !== 'errors')
                      .map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : String(v)}`)
                      .join(' ')}
                  </td>
                  <td className="max-w-[240px] truncate text-danger" title={r.error ?? undefined}>
                    {r.error ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel label="Identity mappings">
          {!identities || identities.length === 0 ? (
            <EmptyState>NONE</EmptyState>
          ) : (
            <table className="console-table font-mono">
              <thead><tr><th>Kind</th><th>Value</th><th>Person</th></tr></thead>
              <tbody>
                {identities.map((i) => (
                  <tr key={`${i.kind}:${i.value}`}>
                    <td className="text-ink-4">{i.kind}</td>
                    <td>{i.value}</td>
                    <td className={i.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : 'text-mint'}>
                      {i.profiles?.name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel label="Planning assumptions">
          {!assumptions ? (
            <EmptyState>DB NOT CONNECTED</EmptyState>
          ) : (
            <table className="console-table font-mono">
              <thead><tr><th>Key</th><th>Value</th><th>Note</th></tr></thead>
              <tbody>
                {assumptions.map((a) => (
                  <tr key={a.key}>
                    <td>{a.key}</td>
                    <td className={a.value === null ? 'text-warn' : 'text-ink'}>
                      {a.value === null ? 'NOT SET' : JSON.stringify(a.value)}
                    </td>
                    <td className="max-w-[260px] truncate text-ink-4" title={a.note ?? undefined}>
                      {a.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
