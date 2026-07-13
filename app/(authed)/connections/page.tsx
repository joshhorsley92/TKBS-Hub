import { getConnections, getPeople, type Connection } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import { DASH, fmt, tme } from '@/lib/broadsheet';
import { Avatar, Chip, EmptyState, SHead } from '@/components/broadsheet/primitives';
import { SyncNowButton } from '@/components/broadsheet/connections/SyncNowButton';
import { FreshbooksSync } from '@/components/broadsheet/connections/FreshbooksSync';
import { AssumptionField } from '@/components/broadsheet/connections/AssumptionField';

export const dynamic = 'force-dynamic';

// Connections — what the board is plugged into, and what each plug feeds.
//
// Status is derived, never declared: GitHub is "connected" because repos carry a
// last_synced_at, Slack because a webhook is configured, FreshBooks because a
// token row exists. A card that says "connected" is a card that can prove it.
//
// The machinery that used to live on Settings — sync health, identity mappings,
// planning assumptions — is folded in below. All of it describes the plumbing on
// this page, and none of it had another home.

type IngestRun = {
  id: string;
  job: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
};

type IdentityRow = { kind: string; value: string; profile_id: string | null };

type AssumptionRow = { key: string; value: unknown; note: string | null };

const STATUS_TEXT: Record<Connection['status'], string> = {
  connected: 'Connected',
  planned: 'Not connected',
  error: 'Error',
};

/** danger has no chip tone in the design system; this is the one-off. */
const ERROR_CHIP = {
  background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
  color: 'var(--danger)',
};

/** ingest_runs.stats is free-form JSON. Show the counters, drop the error array
 *  (it gets its own column). */
function statLine(stats: Record<string, unknown> | null): string {
  const entries = Object.entries(stats ?? {}).filter(([k]) => k !== 'errors');
  if (!entries.length) return DASH;
  return entries.map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : String(v)}`).join('  ');
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ fb?: string; fb_msg?: string }>;
}) {
  const { fb, fb_msg } = await searchParams;

  const [connections, people, runs, identities, assumptions] = await Promise.all([
    getConnections(),
    getPeople(),
    safeQuery<IngestRun[]>((s) =>
      s
        .from('ingest_runs')
        .select('id, job, status, started_at, finished_at, stats, error, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ),
    safeQuery<IdentityRow[]>((s) => s.from('identities').select('kind, value, profile_id').order('kind')),
    safeQuery<AssumptionRow[]>((s) => s.from('assumptions').select('key, value, note').order('key')),
  ]);

  // The OAuth app itself. Without these the connect button can only 500, so the
  // page says what's missing instead of offering the click.
  const fbAppConfigured = Boolean(process.env.FRESHBOOKS_CLIENT_ID && process.env.FRESHBOOKS_CLIENT_SECRET);
  const fbConnected = connections.find((c) => c.id === 'freshbooks')?.status === 'connected';

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Connections</h1>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {connections.map((c) => (
          <div key={c.id} className="conncard">
            <div className="conn-l">
              <span className={`conn-dot ${c.status}`} />
              <div>
                <div style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{c.detail}</div>
              </div>
            </div>
            <div className="conn-rules">
              {c.rules.map((r) => (
                <div key={r} className="rule-line">
                  <span className="rule-arrow">→</span>
                  {r}
                </div>
              ))}
            </div>
            <div className="conn-r">
              <Chip
                tone={c.status === 'connected' ? 'mint' : c.status === 'planned' ? 'amber' : ''}
                style={c.status === 'error' ? ERROR_CHIP : undefined}
              >
                <span className="pd" />
                {STATUS_TEXT[c.status]}
              </Chip>
            </div>
          </div>
        ))}
      </div>

      {/* ── FreshBooks ─────────────────────────────────────────────────────── */}

      <SHead title="FreshBooks" />

      {fb === 'connected' && (
        <p style={{ fontSize: 13, color: 'var(--mint-ink)', marginBottom: 12 }}>
          Connected. Run a sync to pull invoices, payments and expenses.
        </p>
      )}
      {fb === 'error' && (
        <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
          Connect failed: {fb_msg ?? 'no reason returned'}
        </p>
      )}

      {!fbAppConfigured ? (
        <EmptyState title="The FreshBooks app keys aren’t configured.">
          <code>FRESHBOOKS_CLIENT_ID</code> and <code>FRESHBOOKS_CLIENT_SECRET</code> are unset, so
          there is no app to authorise against — a connect button here could only error. Register the
          app at <code>my.freshbooks.com/#/developer</code> with redirect URI{' '}
          <code>/api/freshbooks/callback</code>, put both keys in <code>.env.local</code>, and the
          connect flow appears here. Until then revenue, cost and invoices read as unknown across the
          board — never as zero.
        </EmptyState>
      ) : (
        <div className="card pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {fbConnected ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>
                Authorised. Invoices, payments and expenses land in Money and on client life-lines.
              </span>
              <FreshbooksSync />
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>
                App keys are set, but nobody has authorised the account yet. One click, once.
              </span>
              {/* A plain anchor, not a Link: this hands off to a server-side OAuth redirect. */}
              <a className="btn sm" href="/api/freshbooks/connect">
                Connect FreshBooks →
              </a>
            </>
          )}
        </div>
      )}

      {/* ── Sync health ────────────────────────────────────────────────────── */}

      <SHead title="Sync health" right={<SyncNowButton />} />
      {!runs?.length ? (
        <EmptyState title="No sync has run yet.">
          Every ingest — the GitHub poll, the FreshBooks pull — writes a row here with what it found
          and what it broke on. Press <b>Sync now</b> and the first one appears.
        </EmptyState>
      ) : (
        <div className="card pad">
          <table className="ledger">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Found</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const started = r.started_at ?? r.created_at;
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.job}</td>
                    <td
                      className={r.status === 'succeeded' ? 'pos' : r.status === 'failed' ? 'neg' : undefined}
                      style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}
                    >
                      {r.status}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {fmt(started)} · {tme(started)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {/* Null while a run is still in flight — not a zero-length run. */}
                      {r.finished_at ? tme(r.finished_at) : DASH}
                    </td>
                    <td
                      style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-4)' }}
                      title={JSON.stringify(r.stats ?? {})}
                    >
                      {statLine(r.stats)}
                    </td>
                    <td
                      className={r.error ? 'neg' : undefined}
                      style={{ fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.error ?? undefined}
                    >
                      {r.error ?? DASH}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Identities & assumptions ───────────────────────────────────────── */}

      <SHead title="Attribution & assumptions" />
      <div className="grid2">
        {/* Load-bearing: this table is the only reason a commit reads as Joe's or
            Josh's anywhere on the board. */}
        {!identities?.length ? (
          <EmptyState title="No identities mapped.">
            A commit is attributed by matching its author email to a row here. With none mapped,
            every commit in the Timeline is authorless — no avatar, no person filter.
          </EmptyState>
        ) : (
          <div className="card pad">
            <div style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              Identity mappings
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 14 }}>
              How a commit author becomes a person. An unmapped email lands on nobody.
            </p>
            <table className="ledger">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Value</th>
                  <th>Person</th>
                </tr>
              </thead>
              <tbody>
                {identities.map((i) => {
                  const person = i.profile_id ? people?.byId[i.profile_id] : null;
                  return (
                    <tr key={`${i.kind}:${i.value}`}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-4)' }}>{i.kind}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{i.value}</td>
                      <td>
                        {person ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <Avatar person={person} />
                            {person.first}
                          </span>
                        ) : (
                          <span className="unk">{DASH}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!assumptions?.length ? (
          <EmptyState title="No planning assumptions set.">
            The <code>assumptions</code> table is empty or unreachable, so the money model has no
            rate, no capacity and no confidence weighting to work from — and reports “—” rather than
            guessing one.
          </EmptyState>
        ) : (
          <div className="card pad">
            <div style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              Planning assumptions
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 14 }}>
              The only hand-entered constants the money model may use. Unset stays unset.
            </p>
            <table className="ledger">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map((a) => (
                  <tr key={a.key}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{a.key}</td>
                    <td>
                      <AssumptionField assumptionKey={a.key} value={a.value} />
                    </td>
                    <td
                      style={{ fontSize: 12, color: 'var(--ink-4)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={a.note ?? undefined}
                    >
                      {a.note ?? DASH}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
