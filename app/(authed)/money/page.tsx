import Link from 'next/link';
import { getClients, getMoney } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import { DASH, money } from '@/lib/broadsheet';
import { Bars, Chip, EmptyState } from '@/components/broadsheet/primitives';
import { ProposeDecisionButton } from '@/components/broadsheet/money/MoneyForms';

export const dynamic = 'force-dynamic';

// Money — real-data-first, and honest about which parts aren't real yet.
//
// The two rules this page exists to enforce:
//   * Actual and potential are NEVER blended. Actual revenue comes from
//     FreshBooks; potential comes from open planning lines. They stack in the
//     chart but never sum into a single headline.
//   * A missing figure is unknown, not zero. FreshBooks isn't connected, so
//     every "actual" reads "—", which is the truth. Rendering $0 would claim we
//     know we earned nothing.

const KIND_LABEL: Record<string, string> = {
  client_deal: 'client deal',
  product: 'product',
  service_line: 'service line',
  internal_tooling: 'internal tooling',
  pricing: 'pricing',
  hire: 'hire',
  other: 'other',
};

const statusColor = (s: string) =>
  s === 'active'
    ? 'var(--mint-ink)'
    : s === 'committed'
      ? 'var(--blue)'
      : s === 'evaluating'
        ? 'var(--violet)'
        : s === 'killed'
          ? 'var(--danger)'
          : 'var(--ink-4)';

export default async function MoneyPage() {
  const [board, clients, ventures] = await Promise.all([
    getMoney(),
    getClients(),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('ventures').select('id, name').order('name')),
  ]);

  const bars = board.months.map((m) => ({
    month: m.month,
    actual: m.revenueActual,
    potential: m.revenuePotential,
  }));
  const nothingProjected = bars.every((m) => m.actual + m.potential === 0);

  // Only sum what's actually known. With no FreshBooks revenue in, the total is
  // unknown — not zero.
  const known = (k: 'revenueActual' | 'costActual' | 'potentialMonthly'): number | null => {
    const vals = clients.map((c) => c.money[k]).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const totalRevenue = known('revenueActual');
  const totalCost = known('costActual');
  const totalPotential = known('potentialMonthly');

  // Net is only meaningful when both sides are known.
  const net =
    board.signedMonthly !== null && board.monthlySpend !== null
      ? board.signedMonthly - board.monthlySpend
      : null;

  const roster = clients.filter((c) => c.stage !== 'past');

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Money</h1>
        </div>
        <ProposeDecisionButton
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          ventures={ventures ?? []}
        />
      </div>

      {/* ── projection ─────────────────────────────────────────────────── */}
      <div className="card pad" style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <div className="eyebrow">6-month projection</div>
          {board.freshbooksConnected ? (
            <Chip tone="mint">
              <span className="pd" />
              FreshBooks connected
            </Chip>
          ) : (
            <Chip tone="amber">
              <span className="pd" />
              FreshBooks not connected
            </Chip>
          )}
        </div>

        {nothingProjected ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState title="Nothing is on the books.">
              There are no money lines in the planning ledger, and FreshBooks isn’t connected — so
              there is no revenue to project and no actuals to draw. These are empty months, not zero
              months. Propose a decision to put the first line on the board.
            </EmptyState>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 18 }}>
              <Bars data={bars} height={120} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
              <span className="chip">
                <span className="pd" style={{ background: 'var(--ink)' }} />
                Actual · FreshBooks
              </span>
              <span className="chip mint">
                <span className="pd" />
                Projected · weighted by confidence
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── per-client ─────────────────────────────────────────────────── */}
      <div className="shead">
        <h3>Revenue · cost · potential</h3>
        <span className="sample">
          {board.freshbooksConnected ? 'lifetime by client' : 'unknown until FreshBooks is connected'}
        </span>
      </div>
      <div className="card pad">
        {roster.length === 0 ? (
          <div className="empty-inline">No clients on the roster.</div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Client</th>
                <th className="num">Revenue · lifetime</th>
                <th className="num">Cost</th>
                <th className="num">Potential</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((c) => (
                <tr key={c.id} className="clk">
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className={`num ${c.money.revenueActual === null ? 'unk' : 'pos'}`}>
                    {money(c.money.revenueActual)}
                  </td>
                  <td className="num unk">{money(c.money.costActual)}</td>
                  <td
                    className="num"
                    style={c.money.potentialMonthly !== null ? { color: 'var(--mint-ink)' } : undefined}
                  >
                    {c.money.potentialMonthly === null ? DASH : `${money(c.money.potentialMonthly)}/mo`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontFamily: 'var(--disp)' }}>Total</td>
                <td className={`num ${totalRevenue === null ? 'unk' : 'pos'}`}>{money(totalRevenue)}</td>
                <td className="num unk">{money(totalCost)}</td>
                <td className="num" style={totalPotential !== null ? { color: 'var(--mint-ink)' } : undefined}>
                  {totalPotential === null ? DASH : `${money(totalPotential)}/mo`}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── costs ──────────────────────────────────────────────────────── */}
      <div className="shead">
        <h3>Infrastructure &amp; operating costs</h3>
        <span className="sample">from the planning ledger</span>
      </div>

      <div className="grid3" style={{ marginBottom: 14 }}>
        <div className="card pad">
          <div className="eyebrow">Invested in infrastructure</div>
          <div className={`bignum${board.investedOneTime === null ? ' unk' : ''}`}>
            {money(board.investedOneTime)}
          </div>
          <div className="smol">one-time costs booked to date</div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Monthly spend rate</div>
          <div className={`bignum${board.monthlySpend === null ? ' unk' : ''}`}>
            {money(board.monthlySpend)}
            {board.monthlySpend !== null && (
              <span style={{ fontSize: 14, color: 'var(--ink-4)', fontWeight: 400 }}>/mo</span>
            )}
          </div>
          <div className="smol">
            {board.monthlySpend === null
              ? 'no recurring costs entered'
              : `${money(board.monthlySpend * 12)} annualized`}
          </div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Net monthly</div>
          <div
            className={`bignum${net === null ? ' unk' : ''}`}
            style={net !== null ? { color: net >= 0 ? 'var(--mint-ink)' : 'var(--danger)' } : undefined}
          >
            {net === null ? DASH : `${net >= 0 ? '+' : ''}${money(net)}`}
            {net !== null && <span style={{ fontSize: 14, color: 'var(--ink-4)', fontWeight: 400 }}>/mo</span>}
          </div>
          <div className="smol">
            {net === null ? 'needs both recurring revenue and spend' : 'recurring revenue − monthly spend'}
          </div>
        </div>
      </div>

      <div className="card pad">
        {board.costs.length === 0 ? (
          <div className="empty-inline">
            No cost lines entered. Hosting, tooling and subscriptions land here once someone books
            them — or automatically, once FreshBooks expenses sync.
          </div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Line item</th>
                <th>Category</th>
                <th className="num">Invested</th>
                <th className="num">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {board.costs.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.memo ?? <span className="unk">Untitled line</span>}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{c.category}</td>
                  <td className="num" style={{ color: c.cadence === 'one_time' ? 'var(--ink)' : 'var(--ink-4)' }}>
                    {c.cadence === 'one_time' ? money(c.amount) : DASH}
                  </td>
                  <td className="num" style={{ color: c.cadence === 'monthly' ? 'var(--danger)' : 'var(--ink-4)' }}>
                    {c.cadence === 'monthly' ? `${money(c.amount)}/mo` : DASH}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── decisions ──────────────────────────────────────────────────── */}
      <div className="shead">
        <h3>Decisions</h3>
        <span className="sample">the projection ledger</span>
      </div>
      <div className="card pad">
        {board.decisions.length === 0 ? (
          <EmptyState title="No decisions proposed yet.">
            A decision is the case for doing something — what it costs, what it should bring in, and
            why. It is the unit this board projects from. Propose one and it becomes a line in the
            forecast above.
          </EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Kind</th>
                <th>Status</th>
                <th className="num">Proj. rev</th>
                <th className="num">Proj. cost</th>
                <th className="num">Proj. net</th>
              </tr>
            </thead>
            <tbody>
              {board.decisions.map((d) => {
                const hasBoth = d.projectedRevenue !== null && d.projectedCost !== null;
                const dNet = hasBoth ? d.projectedRevenue! - d.projectedCost! : null;
                return (
                  <tr key={d.id} className="clk">
                    <td style={{ fontWeight: 500 }}>
                      <Link href={`/money/decisions/${d.id}`}>{d.title}</Link>
                    </td>
                    <td style={{ color: 'var(--ink-3)' }}>{KIND_LABEL[d.kind] ?? d.kind}</td>
                    <td>
                      <span className="stat" style={{ color: statusColor(d.status) }}>
                        {d.status}
                      </span>
                    </td>
                    <td className={`num${d.projectedRevenue === null ? ' unk' : ''}`}>
                      {money(d.projectedRevenue)}
                    </td>
                    <td className={`num${d.projectedCost === null ? ' unk' : ''}`} style={{ color: 'var(--ink-4)' }}>
                      {money(d.projectedCost)}
                    </td>
                    <td className={`num ${dNet === null ? 'unk' : dNet >= 0 ? 'pos' : 'neg'}`}>{money(dNet)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
