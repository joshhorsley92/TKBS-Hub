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

export default async function MoneyPage() {
  const [decisions, pnl] = await Promise.all([
    safeQuery<DecisionPnl[]>((s) => s.from('v_decision_pnl').select('*')),
    safeQuery<PnlRow[]>((s) =>
      s
        .from('v_company_pnl_monthly')
        .select('*')
        .gte('month', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
        .order('month'),
    ),
  ]);

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
