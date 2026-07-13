'use client';

import Link from 'next/link';
import type { Initiative, MoneyBoard } from '@/lib/board';
import { DASH, money, moneyK } from '@/lib/broadsheet';
import { Avatar, Bars, Chip, Progress } from '../primitives';
import { useWorkspace } from '../WorkspaceProvider';

/* ── Active initiatives ──────────────────────────────────────────────────── */

export function ActiveInitiatives({ initiatives }: { initiatives: Initiative[] }) {
  const { peopleById } = useWorkspace();
  const active = initiatives.filter((i) => i.status === 'active');

  return (
    <div>
      <div className="shead">
        <h3>Active initiatives</h3>
        <Link href="/initiatives" className="tog">
          All →
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="empty-state">
          <div className="es-t">No active initiatives.</div>
          <div className="es-s">
            Initiatives are the bets you’re choosing to make — hand-kept, not derived from repo
            activity. Add one from the Initiatives page.
          </div>
          <Link href="/initiatives" className="btn mint sm">
            Go to Initiatives
          </Link>
        </div>
      ) : (
        <div className="card pad">
          <div className="grid2" style={{ gap: '16px 30px' }}>
            {active.slice(0, 6).map((i) => {
              const blocker = i.blockedOnExternal
                ? 'Client'
                : i.blockedOnProfileId
                  ? (peopleById[i.blockedOnProfileId]?.first ?? 'someone')
                  : null;
              return (
                <Link
                  key={i.id}
                  href={`/initiatives/${i.id}`}
                  style={{ cursor: 'pointer', color: 'inherit', display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 500, fontSize: 13.5 }}>{i.title}</span>
                    <Avatar person={peopleById[i.ownerId]} />
                  </div>
                  <Progress value={i.progress} health={i.health} style={{ marginTop: 8 }} />
                  {blocker && (
                    <div style={{ marginTop: 7 }}>
                      <Chip tone="amber">
                        <span className="pd" />
                        Blocked · {blocker}
                      </Chip>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Money & projection ──────────────────────────────────────────────────── */

export function Projection({ board }: { board: MoneyBoard }) {
  const data = board.months.map((m) => ({
    month: m.month,
    actual: m.revenueActual,
    potential: m.revenuePotential,
  }));

  const totalActual = data.reduce((s, m) => s + m.actual, 0);
  const totalPotential = data.reduce((s, m) => s + m.potential, 0);
  const nothingOnTheBooks = totalActual === 0 && totalPotential === 0;

  return (
    <div>
      <div className="shead">
        <h3>Money &amp; projection</h3>
        <Link href="/money" className="tog">
          Money →
        </Link>
      </div>

      <div className="card pad">
        <div className="grid2" style={{ alignItems: 'center', gap: '0 32px' }}>
          <div>
            <div className="eyebrow">6-month projection</div>

            {nothingOnTheBooks ? (
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '10px 0 14px', maxWidth: '40ch' }}>
                Nothing is on the books. There are no money lines in the planning ledger and
                FreshBooks isn’t connected, so there is no revenue to project — that’s an empty
                ledger, not a zero month.
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '8px 0 6px' }}>
                <span
                  style={{
                    fontFamily: 'var(--disp)',
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: '-.02em',
                  }}
                >
                  {moneyK(totalActual)}
                </span>
                <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>
                  actual · {moneyK(totalPotential)} projected
                </span>
              </div>
            )}

            <Bars data={data} height={88} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {(
              [
                [
                  board.signedMonthly == null ? DASH : `${money(board.signedMonthly)}`,
                  'Signed run-rate / mo',
                  board.signedMonthly != null,
                ],
                [
                  board.monthlySpend == null ? DASH : `${money(board.monthlySpend)}`,
                  'Monthly spend rate',
                  false,
                ],
                [
                  board.freshbooksConnected ? 'Connected' : DASH,
                  board.freshbooksConnected ? 'FreshBooks actuals' : 'FreshBooks — not connected',
                  false,
                ],
              ] as [string, string, boolean][]
            ).map(([v, l, pos], k) => (
              <div key={k} style={{ borderLeft: '2px solid var(--line)', paddingLeft: 13 }}>
                <div
                  className={pos ? 'pos' : v === DASH ? 'unk' : undefined}
                  style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 19 }}
                >
                  {v}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Status stamp ────────────────────────────────────────────────────────── */

/**
 * Reflects the REAL sync state. The prototype cycled green→amber on a timer to
 * look alive; this reports what actually happened on the last GitHub poll.
 */
export function StatusStamp({ lastSync, failed }: { lastSync: string | null; failed: boolean }) {
  const color = failed ? 'var(--danger)' : lastSync ? 'var(--mint)' : 'var(--amber)';
  const label = failed
    ? 'Sync failed'
    : lastSync
      ? new Date(lastSync).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'Never synced';
  const title = failed
    ? 'The last GitHub sync failed — see Connections'
    : lastSync
      ? 'Last successful GitHub sync'
      : 'GitHub has never synced — see Connections';

  return (
    <div className={`sstamp${failed ? ' steady' : ''}`} title={title}>
      <span className="sd" style={{ background: color }} />
      {label}
    </div>
  );
}
