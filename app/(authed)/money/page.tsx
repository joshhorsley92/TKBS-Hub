import Link from 'next/link';
import { Panel, EmptyState } from '@/components/console/Panel';
import { NewDecisionForm } from '@/components/money/MoneyForms';
import { ProjectionChart, type PnlMonth } from '@/components/charts/ProjectionChart';
import { safeQuery, isDbConfigured } from '@/lib/data';
import { money } from '@/lib/format';

type DecisionPnl = {
  id: string;
  title: string;
  status: string;
  kind: string;
  projected_revenue: number | null;
  projected_cost: number | null;
  actual_revenue_to_date: number | null;
  actual_cost_to_date: number | null;
};

type PnlRow = { month: string; certainty: string; revenue: number; cost: number; net: number };

const STATUS_ORDER = ['active', 'committed', 'evaluating', 'idea', 'done', 'killed'];
const STATUS_COLOR: Record<string, string> = {
  idea: 'text-ink-4',
  evaluating: 'text-pot',
  committed: 'text-commit-2',
  active: 'text-actual',
  done: 'text-ink-3',
  killed: 'text-ink-5',
};

type CapacityRow = { month: string; profile_id: string | null; kind: string; hours: number };

export default async function MoneyPage() {
  const [decisions, pnl, capacity, capacityAssumption, profiles] = await Promise.all([
    safeQuery<DecisionPnl[]>((s) => s.from('v_decision_pnl').select('*')),
    safeQuery<PnlRow[]>((s) =>
      s
        .from('v_company_pnl_monthly')
        .select('*')
        .gte('month', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
        .order('month'),
    ),
    safeQuery<CapacityRow[]>((s) =>
      s
        .from('v_capacity_monthly')
        .select('*')
        .gte('month', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
        .order('month'),
    ),
    safeQuery<{ value: unknown }>((s) =>
      s.from('assumptions').select('value').eq('key', 'weekly_capacity_hours').single(),
    ),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('profiles').select('id, name').order('name')),
  ]);

  const weeklyCapacity =
    capacityAssumption?.value != null && typeof capacityAssumption.value === 'number'
      ? capacityAssumption.value
      : null;
  const monthlyCapacity = weeklyCapacity != null ? weeklyCapacity * 4.33 : null;
  const nameOf = (id: string | null) =>
    (profiles ?? []).find((p) => p.id === id)?.name.split(' ')[0] ?? 'unassigned';

  // month → person → projected hours (next 6 months)
  const capMonths = [...new Set((capacity ?? []).filter((c) => c.kind === 'projected').map((c) => c.month))]
    .sort()
    .slice(0, 6);

  // Chart data: next 12 months, real vs weighted-potential separated.
  const byMonth = new Map<string, PnlMonth>();
  for (const r of pnl ?? []) {
    const key = new Date(r.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const row = byMonth.get(key) ?? { month: key, actual_revenue: 0, projected_revenue: 0, cost: 0 };
    if (r.certainty === 'actual') row.actual_revenue += Number(r.revenue);
    else row.projected_revenue += Number(r.revenue);
    row.cost += Number(r.cost);
    byMonth.set(key, row);
  }
  const chartData = [...byMonth.values()].slice(0, 12);

  const sorted = (decisions ?? []).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  const openDecisions = sorted.filter((d) => !['done', 'killed'].includes(d.status));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Money</h1>
          <p className="font-mono text-[11px] text-ink-4">
            planning ledger — FreshBooks actuals land in Phase 2 · real and potential never blended
          </p>
        </div>
        <NewDecisionForm />
      </div>

      <Panel label="12-month projection" className="mb-3">
        {chartData.length === 0 ? (
          <EmptyState>
            {isDbConfigured()
              ? 'NO MONEY LINES YET — PROPOSE A DECISION AND ADD PROJECTED LINES'
              : 'DB NOT CONNECTED'}
          </EmptyState>
        ) : (
          <ProjectionChart data={chartData} />
        )}
      </Panel>

      <Panel label="Capacity — committed hours vs the two of you" className="mb-3">
        {capMonths.length === 0 ? (
          <EmptyState>
            NO TIME-COST LINES YET — ADD HRS/MO COST LINES TO COMMITTED DECISIONS AND CAPACITY APPEARS HERE
          </EmptyState>
        ) : (
          <div>
            <table className="console-table font-mono">
              <thead>
                <tr>
                  <th>Month</th>
                  {(profiles ?? []).map((p) => <th key={p.id}>{p.name.split(' ')[0]}</th>)}
                  <th>Unassigned</th>
                  <th>Total</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {capMonths.map((m) => {
                  const rows = (capacity ?? []).filter((c) => c.month === m && c.kind === 'projected');
                  const total = rows.reduce((s, r) => s + Number(r.hours), 0);
                  const totalCapacity = monthlyCapacity != null ? monthlyCapacity * (profiles?.length ?? 2) : null;
                  const over = totalCapacity != null && total > totalCapacity;
                  return (
                    <tr key={m}>
                      <td>{new Date(m).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</td>
                      {(profiles ?? []).map((p) => {
                        const h = rows.filter((r) => r.profile_id === p.id).reduce((s, r) => s + Number(r.hours), 0);
                        const personOver = monthlyCapacity != null && h > monthlyCapacity;
                        return (
                          <td key={p.id} className={personOver ? 'text-danger' : undefined}>
                            {h ? `${Math.round(h)}h` : '—'}
                          </td>
                        );
                      })}
                      <td className="text-ink-4">
                        {(() => {
                          const h = rows.filter((r) => !r.profile_id).reduce((s, r) => s + Number(r.hours), 0);
                          return h ? `${Math.round(h)}h` : '—';
                        })()}
                      </td>
                      <td className={over ? 'text-danger' : 'text-ink-2'}>{Math.round(total)}h</td>
                      <td className={over ? 'text-danger' : 'text-ink-4'}>
                        {totalCapacity != null ? `${Math.round(totalCapacity)}h${over ? ' ⚠ OVER' : ''}` : 'not set'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {monthlyCapacity == null && (
              <p className="mt-2 font-mono text-[10.5px] text-warn">
                ⚠ weekly_capacity_hours NOT SET — set it in Settings and the over-capacity signal (the hiring trigger) lights up
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel label="Decisions">
        {openDecisions.length === 0 && sorted.length === 0 ? (
          <EmptyState>NO DECISIONS PROPOSED YET</EmptyState>
        ) : (
          <table className="console-table font-mono">
            <thead>
              <tr>
                <th>Decision</th><th>Kind</th><th>Status</th>
                <th>Proj rev</th><th>Proj cost</th><th>Net (proj)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const pr = Number(d.projected_revenue ?? 0);
                const pc = Number(d.projected_cost ?? 0);
                const net = pr - pc;
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/money/decisions/${d.id}`} className="text-ink transition hover:text-mint">
                        {d.title}
                      </Link>
                    </td>
                    <td className="text-ink-4">{d.kind.replace(/_/g, ' ')}</td>
                    <td className={STATUS_COLOR[d.status] ?? ''}>{d.status.toUpperCase()}</td>
                    <td>{pr ? money(pr) : '—'}</td>
                    <td>{pc ? money(pc) : '—'}</td>
                    <td className={net > 0 ? 'text-actual' : net < 0 ? 'text-danger' : 'text-ink-4'}>
                      {pr || pc ? money(net) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
