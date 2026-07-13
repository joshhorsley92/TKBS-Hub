import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeQuery } from '@/lib/data';
import { getPeople } from '@/lib/board';
import { DASH, fmtY, money } from '@/lib/broadsheet';
import { Avatar, Chip } from '@/components/broadsheet/primitives';
import {
  DecisionStatusControls,
  DeleteLineButton,
  NewMoneyLineForm,
  RealizeControl,
} from '@/components/broadsheet/money/MoneyForms';

export const dynamic = 'force-dynamic';

// A decision, rendered as a report — "the case" for doing the thing, with the
// money attached to it. Projected revenue and cost come from its money lines;
// either can legitimately be unknown, and then the net is unknown too. We do not
// treat a missing cost as a free decision.

type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type DecisionRow = {
  id: string;
  title: string;
  summary: string | null;
  kind: string;
  status: string;
  proposed_by: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  client_id: string | null;
  venture_id: string | null;
  clients: Embed<{ id: string; name: string; industry: string | null }>;
  ventures: Embed<{ id: string; name: string }>;
};

type LineRow = {
  id: string;
  direction: 'revenue' | 'cost';
  cadence: 'one_time' | 'monthly';
  amount: string;
  confidence: string;
  status: string;
  memo: string | null;
  occurs_on: string | null;
  starts_on: string | null;
};

const KIND_LABEL: Record<string, string> = {
  client_deal: 'client deal',
  product: 'product',
  service_line: 'service line',
  internal_tooling: 'internal tooling',
  pricing: 'pricing',
  hire: 'hire',
  other: 'other',
};

const kindTone = (k: string) =>
  k === 'product' ? 'violet' : k === 'client_deal' ? 'blue' : k === 'service_line' ? 'mint' : '';

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rows, lineRows, events, invoices, people] = await Promise.all([
    safeQuery<DecisionRow[]>((s) =>
      s
        .from('decisions')
        .select(
          'id, title, summary, kind, status, proposed_by, decided_by, decided_at, created_at, client_id, venture_id, clients:client_id(id, name, industry), ventures:venture_id(id, name)',
        )
        .eq('id', id)
        .limit(1),
    ),
    safeQuery<LineRow[]>((s) =>
      s
        .from('money_lines')
        .select('id, direction, cadence, amount, confidence, status, memo, occurs_on, starts_on')
        .eq('decision_id', id)
        .order('created_at'),
    ),
    safeQuery<{ id: number; from_status: string | null; to_status: string; note: string | null; created_at: string; actor_id: string | null }[]>(
      (s) =>
        s
          .from('decision_events')
          .select('id, from_status, to_status, note, created_at, actor_id')
          .eq('decision_id', id)
          .order('created_at', { ascending: false }),
    ),
    // Realization targets. FreshBooks isn't connected, so this is empty — and
    // the realize control says so rather than offering a dead dropdown.
    safeQuery<{ fb_id: number; number: string | null }[]>((s) =>
      s.from('fb_invoices').select('fb_id, number').order('create_date', { ascending: false }).limit(40),
    ),
    getPeople(),
  ]);

  const d = rows?.[0];
  if (!d) notFound();

  const lines = lineRows ?? [];
  const open = lines.filter((l) => l.status === 'open');

  // Sum only what exists. No lines of a kind → unknown, not zero.
  const sum = (dir: 'revenue' | 'cost'): number | null => {
    const mine = open.filter((l) => l.direction === dir);
    return mine.length ? mine.reduce((s, l) => s + (Number(l.amount) || 0), 0) : null;
  };
  const projRev = sum('revenue');
  const projCost = sum('cost');
  const net = projRev !== null && projCost !== null ? projRev - projCost : null;

  // If every open line is monthly, the figures are per-month.
  const allMonthly = open.length > 0 && open.every((l) => l.cadence === 'monthly');
  const sfx = allMonthly ? '/mo' : '';

  const client = one(d.clients);
  const venture = one(d.ventures);
  const proposer = people?.byId[d.proposed_by];

  return (
    <>
      <Link href="/money" className="backlink">
        ← Money
      </Link>

      <div className="topline">
        <div>
          <div className="kicker">
            <Chip tone={kindTone(d.kind) as 'violet' | 'blue' | 'mint' | ''}>
              {KIND_LABEL[d.kind] ?? d.kind}
            </Chip>
            <span className="stat" style={{ marginLeft: 8 }}>
              {d.status}
            </span>
          </div>
          <h1 className="h1" style={{ maxWidth: '20ch' }}>
            {d.title}
          </h1>
        </div>
        <div className="stamp">
          <div
            style={{
              fontFamily: 'var(--disp)',
              fontWeight: 700,
              fontSize: 22,
              color: net === null ? 'var(--ink-4)' : net >= 0 ? 'var(--mint-ink)' : 'var(--danger)',
            }}
          >
            {net === null ? DASH : `${net >= 0 ? '+' : ''}${money(net)}${sfx}`}
          </div>
          <div style={{ marginTop: 4 }}>projected net</div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Avatar person={proposer} />
          </div>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 6 }}>
        <div className="card pad">
          <div className="eyebrow">Projected revenue</div>
          <div className={`bignum${projRev === null ? ' unk' : ''}`}>
            {money(projRev)}
            {projRev !== null && sfx}
          </div>
          <div className="smol">{projRev === null ? 'no revenue line yet' : `${open.filter((l) => l.direction === 'revenue').length} open line(s)`}</div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Projected cost</div>
          <div className={`bignum${projCost === null ? ' unk' : ''}`}>
            {money(projCost)}
            {projCost !== null && sfx}
          </div>
          <div className="smol">
            {projCost === null ? 'no cost line — that is unknown, not free' : `${open.filter((l) => l.direction === 'cost').length} open line(s)`}
          </div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Projected net</div>
          <div
            className={`bignum${net === null ? ' unk' : ''}`}
            style={net !== null ? { color: net >= 0 ? 'var(--mint-ink)' : 'var(--danger)' } : undefined}
          >
            {net === null ? DASH : `${net >= 0 ? '+' : ''}${money(net)}${sfx}`}
          </div>
          <div className="smol">
            {proposer ? `proposed by ${proposer.first}` : ''}
            {d.created_at ? ` · ${fmtY(d.created_at)}` : ''}
          </div>
        </div>
      </div>

      <div className="shead">
        <h3>Status</h3>
      </div>
      <div className="card pad">
        <DecisionStatusControls id={d.id} status={d.status} />
        {d.decided_by && d.decided_at && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 12 }}>
            Decided by {people?.byId[d.decided_by]?.first ?? 'someone'} on {fmtY(d.decided_at)}.
          </p>
        )}
      </div>

      <div className="shead">
        <h3>The case</h3>
      </div>
      <div className="card pad digest-card">
        <div className="digest" style={{ whiteSpace: 'pre-wrap' }}>
          {d.summary ?? (
            <span className="unk">
              No rationale written yet. A decision without a case is just an expense — write down why
              this is worth doing.
            </span>
          )}
        </div>
      </div>

      <div className="shead">
        <h3>Money lines</h3>
        <span className="sample">projected · realize against a FreshBooks invoice</span>
      </div>
      <div className="card pad">
        {lines.length === 0 ? (
          <div className="empty-inline">
            No money lines yet. Add one below and it joins the six-month projection.
          </div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Memo</th>
                <th>Direction</th>
                <th>Cadence</th>
                <th className="num">Amount</th>
                <th className="num">Confidence</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.memo ?? <span className="unk">—</span>}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{l.direction}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{l.cadence === 'monthly' ? 'monthly' : 'one-time'}</td>
                  <td className={`num ${l.direction === 'revenue' ? 'pos' : 'neg'}`}>
                    {money(Number(l.amount))}
                    {l.cadence === 'monthly' ? '/mo' : ''}
                  </td>
                  <td className="num" style={{ color: 'var(--ink-4)' }}>
                    {Math.round(Number(l.confidence) * 100)}%
                  </td>
                  <td>
                    <span
                      className="stat"
                      style={{
                        color:
                          l.status === 'realized'
                            ? 'var(--mint-ink)'
                            : l.status === 'cancelled'
                              ? 'var(--ink-4)'
                              : 'var(--blue)',
                      }}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {l.status === 'open' && (
                      <>
                        <RealizeControl lineId={l.id} invoices={invoices ?? []} />
                        <DeleteLineButton lineId={l.id} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <NewMoneyLineForm decisionId={d.id} clientId={d.client_id} ventureId={d.venture_id} />
      </div>

      {(client || venture) && (
        <>
          <div className="shead">
            <h3>Linked</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {client && (
              <Link href={`/clients/${client.id}`} className="linkcard" style={{ minWidth: 260 }}>
                <div className="eyebrow">Client</div>
                <b style={{ fontFamily: 'var(--disp)', fontSize: 14, display: 'block', marginTop: 5 }}>
                  {client.name}
                </b>
                {client.industry && (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{client.industry}</p>
                )}
              </Link>
            )}
            {venture && (
              <Link href={`/builds/${venture.id}`} className="linkcard" style={{ minWidth: 260 }}>
                <div className="eyebrow">Build</div>
                <b style={{ fontFamily: 'var(--disp)', fontSize: 14, display: 'block', marginTop: 5 }}>
                  {venture.name}
                </b>
              </Link>
            )}
          </div>
        </>
      )}

      {events && events.length > 0 && (
        <>
          <div className="shead">
            <h3>Lifecycle</h3>
          </div>
          <div className="card pad">
            <div className="river">
              {events.map((e) => (
                <div key={e.id} className="ev">
                  <span className="node2" style={{ background: 'var(--ink)' }} />
                  <span className="t">{fmtY(e.created_at)}</span>
                  <div className="body">
                    <b>
                      {e.from_status ? `${e.from_status} → ${e.to_status}` : `created as ${e.to_status}`}
                    </b>
                    {e.note && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{e.note}</div>}
                    <div className="meta">
                      <Avatar person={e.actor_id ? people?.byId[e.actor_id] : null} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
