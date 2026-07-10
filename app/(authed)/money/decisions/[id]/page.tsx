import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Panel, EmptyState } from '@/components/console/Panel';
import { DecisionStatusControls, LineActions, NewLineForm } from '@/components/money/MoneyForms';
import { RealizeControl, type InvoiceOption } from '@/components/money/RealizeControl';
import { safeQuery } from '@/lib/data';
import { logStamp, money, shortDate } from '@/lib/format';

type LineRow = {
  id: string;
  direction: string;
  cadence: string;
  amount: number;
  confidence: number;
  status: string;
  occurs_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  category: string;
  memo: string | null;
};

type EventRow = {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  profiles: { name: string } | null;
};

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const decision = await safeQuery<{
    id: string;
    title: string;
    summary: string | null;
    kind: string;
    status: string;
    created_at: string;
    decided_at: string | null;
    proposer: { name: string } | null;
    decider: { name: string } | null;
    clients: { id: string; name: string } | null;
    ventures: { name: string } | null;
  }>((s) =>
    s
      .from('decisions')
      .select(
        'id, title, summary, kind, status, created_at, decided_at, proposer:proposed_by (name), decider:decided_by (name), clients:client_id (id, name), ventures:venture_id (name)',
      )
      .eq('id', id)
      .single(),
  );
  if (!decision) notFound();

  const [lines, events, invoices] = await Promise.all([
    safeQuery<LineRow[]>((s) =>
      s
        .from('money_lines')
        .select('id, direction, cadence, amount, confidence, status, occurs_on, starts_on, ends_on, category, memo')
        .eq('decision_id', id)
        .order('created_at'),
    ),
    safeQuery<EventRow[]>((s) =>
      s
        .from('decision_events')
        .select('id, from_status, to_status, note, created_at, profiles:actor_id (name)')
        .eq('decision_id', id)
        .order('created_at', { ascending: false })
        .returns<EventRow[]>(),
    ),
    safeQuery<{ fb_id: number; number: string | null; amount: number | null; create_date: string | null }[]>((s) =>
      s
        .from('fb_invoices')
        .select('fb_id, number, amount, create_date')
        .order('create_date', { ascending: false })
        .limit(40),
    ),
  ]);

  const invoiceOptions: InvoiceOption[] = (invoices ?? []).map((i) => ({
    fb_id: i.fb_id,
    label: `#${i.number ?? i.fb_id} · $${Number(i.amount ?? 0).toLocaleString()}${i.create_date ? ` · ${shortDate(i.create_date)}` : ''}`,
  }));

  const open = (lines ?? []).filter((l) => l.status === 'open');
  const monthlyRev = open.filter((l) => l.direction === 'revenue' && l.cadence === 'monthly').reduce((s, l) => s + Number(l.amount) * Number(l.confidence), 0);
  const monthlyCost = open.filter((l) => l.direction === 'cost' && l.cadence === 'monthly').reduce((s, l) => s + Number(l.amount) * Number(l.confidence), 0);
  const oneTimeRev = open.filter((l) => l.direction === 'revenue' && l.cadence === 'one_time').reduce((s, l) => s + Number(l.amount) * Number(l.confidence), 0);
  const oneTimeCost = open.filter((l) => l.direction === 'cost' && l.cadence === 'one_time').reduce((s, l) => s + Number(l.amount) * Number(l.confidence), 0);

  return (
    <div>
      <Link href="/money" className="mb-3 flex w-fit items-center gap-1.5 font-mono text-[11px] text-ink-4 transition hover:text-ink-2">
        <ArrowLeft size={12} /> MONEY
      </Link>

      <div className="mb-3">
        <h1 className="text-lg font-bold">{decision.title}</h1>
        <p className="font-mono text-[11px] text-ink-4">
          {decision.kind.replace(/_/g, ' ')} · proposed by {decision.proposer?.name ?? '—'} {shortDate(decision.created_at)}
          {decision.decider ? ` · decided by ${decision.decider.name}${decision.decided_at ? ` ${shortDate(decision.decided_at)}` : ''}` : ' · not yet decided'}
          {decision.clients ? (
            <> · <Link href={`/clients/${decision.clients.id}`} className="transition hover:text-mint">{decision.clients.name}</Link></>
          ) : null}
          {decision.ventures ? ` · ${decision.ventures.name}` : null}
        </p>
        {decision.summary && <p className="mt-1 max-w-[90ch] text-[12.5px] text-ink-3">{decision.summary}</p>}
      </div>

      <Panel className="mb-3">
        <DecisionStatusControls id={decision.id} status={decision.status} />
      </Panel>

      <Panel
        label="Projected P&L (confidence-weighted)"
        className="mb-3"
        action={
          <span className="font-mono text-[11px] text-ink-3">
            {monthlyRev || monthlyCost ? (
              <>
                <span className={monthlyRev - monthlyCost >= 0 ? 'text-actual' : 'text-danger'}>
                  {money(monthlyRev - monthlyCost)}/mo
                </span>
                {' · '}
              </>
            ) : null}
            {oneTimeRev || oneTimeCost ? (
              <span className={oneTimeRev - oneTimeCost >= 0 ? 'text-actual' : 'text-danger'}>
                {money(oneTimeRev - oneTimeCost)} one-time
              </span>
            ) : null}
          </span>
        }
      >
        <div className="mb-2.5">
          <NewLineForm decisionId={decision.id} />
        </div>
        {!lines || lines.length === 0 ? (
          <EmptyState>NO MONEY LINES — ADD PROJECTED REVENUE AND COSTS ABOVE</EmptyState>
        ) : (
          <table className="console-table font-mono">
            <thead>
              <tr>
                <th>Dir</th><th>Cadence</th><th>Amount</th><th>Conf</th><th>Window</th><th>Memo</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className={l.status !== 'open' ? 'opacity-50' : undefined}>
                  <td className={l.direction === 'revenue' ? 'text-actual' : 'text-cost'}>
                    {l.direction === 'revenue' ? 'REV' : 'COST'}
                  </td>
                  <td className="text-ink-4">{l.cadence === 'monthly' ? '/mo' : 'once'}</td>
                  <td>{money(Number(l.amount))}</td>
                  <td className={Number(l.confidence) < 1 ? 'text-pot' : 'text-ink-4'}>
                    {Math.round(Number(l.confidence) * 100)}%
                  </td>
                  <td className="text-ink-4">
                    {l.cadence === 'one_time'
                      ? l.occurs_on ? shortDate(l.occurs_on) : '—'
                      : `${l.starts_on ? shortDate(l.starts_on) : '—'} → ${l.ends_on ? shortDate(l.ends_on) : 'open'}`}
                  </td>
                  <td className="max-w-[220px] truncate text-ink-3" title={l.memo ?? undefined}>{l.memo ?? '—'}</td>
                  <td className="text-ink-4">{l.status}</td>
                  <td className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {l.status === 'open' && l.direction === 'revenue' && (
                        <RealizeControl lineId={l.id} invoices={invoiceOptions} />
                      )}
                      <LineActions id={l.id} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel label="Lifecycle">
        {!events || events.length === 0 ? (
          <EmptyState>NO EVENTS</EmptyState>
        ) : (
          <div className="font-mono">
            {events.map((e) => (
              <div key={e.id} className="flex items-baseline gap-2.5 border-b border-edge-2 py-[5.5px] text-[11.5px] last:border-b-0">
                <span className="w-[42px] shrink-0 text-ink-5">{logStamp(e.created_at)}</span>
                <span className="min-w-0 flex-1 text-ink-2">
                  {e.from_status ? `${e.from_status} → ` : ''}<span className="text-ink">{e.to_status}</span>
                  {e.note ? <span className="text-ink-4"> — {e.note}</span> : null}
                </span>
                <span className={`shrink-0 text-[10px] ${e.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : 'text-mint'}`}>
                  {(e.profiles?.name ?? '').split(' ')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
