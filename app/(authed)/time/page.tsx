import Link from 'next/link';
import { getPeople, getTime } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import { DASH, fmtY, money, num } from '@/lib/broadsheet';
import { Avatar, Chip, EmptyState } from '@/components/broadsheet/primitives';
import {
  AssignSession,
  LogTimeButton,
  SubscriptionInput,
} from '@/components/broadsheet/time/TimeForms';

export const dynamic = 'force-dynamic';

// Time & cost.
//
// Hours come from two places and are never confused for one another:
//   * Claude Code sessions track themselves — a hook derives the whole session
//     from its transcript on every turn. Nothing to type.
//   * Everything else (calls, bookkeeping, design) is logged by hand, because
//     it generates no events and pretending otherwise would under-report
//     everyone but Joe.
//
// COST is the part that's easy to get wrong, so this page keeps the two
// answers apart:
//   * IMPUTED  — tokens at Anthropic list price. NOTIONAL. Claude Code bills
//     against a subscription, so this money was never spent. It answers "what
//     would this cost on the API?" — the number that matters when pricing work.
//   * ALLOCATED — the real subscription bill, split pro-rata by token share.
//     REAL CASH. Unknown until someone enters what the subscription costs.
//
// They are never summed. Doing so would double-count the same work.

const HOURS = (h: number) => `${h.toFixed(1)}h`;

export default async function TimePage() {
  const [board, people, clients, ventures] = await Promise.all([
    getTime(),
    getPeople(),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('clients').select('id, name').order('name')),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('ventures').select('id, name').order('name')),
  ]);

  const options = { clients: clients ?? [], ventures: ventures ?? [] };
  const claudeHours = board.sessions.filter((s) => s.source === 'claude').reduce((a, s) => a + s.workedHours, 0);
  const manualHours = board.totalHours - claudeHours;

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Time</h1>
          <p className="sub">
            Claude sessions track themselves. Everything else gets logged by hand — otherwise the
            board only ever sees the engineering.
          </p>
        </div>
        <LogTimeButton {...options} />
      </div>

      {board.sessions.length === 0 ? (
        <EmptyState title="No time tracked yet.">
          The Claude Code hook records a session the moment a chat window does any work — no command
          to run. If you’ve been working and nothing is here, check that the hook is installed (see{' '}
          <code>.claude/settings.json</code>). Non-Claude work — calls, bookkeeping, design — needs
          logging by hand.
        </EmptyState>
      ) : (
        <>
          {/* ── the three numbers ──────────────────────────────────────── */}
          <div className="grid3" style={{ marginTop: 4 }}>
            <div className="card pad">
              <div className="eyebrow">Hours worked</div>
              <div className="bignum">{HOURS(board.totalHours)}</div>
              <div className="smol">
                {HOURS(claudeHours)} in Claude · {HOURS(manualHours)} logged by hand
              </div>
            </div>

            <div className="card pad">
              <div className="eyebrow">Labour cost · real</div>
              <div className={`bignum${board.totalLabour === null ? ' unk' : ''}`}>
                {money(board.totalLabour)}
              </div>
              <div className="smol">
                {board.totalLabour === null
                  ? 'nobody has an hourly rate on file'
                  : 'hours × each person’s rate'}
              </div>
            </div>

            <div className="card pad">
              <div className="eyebrow">Claude cost · allocated · real</div>
              <div className={`bignum${board.allocatedThisMonth === null ? ' unk' : ''}`}>
                {money(board.allocatedThisMonth)}
              </div>
              <div className="smol">
                {board.subscriptionMonthly === null
                  ? 'needs the monthly subscription figure — below'
                  : `${money(board.subscriptionMonthly)}/mo, split by token share`}
              </div>
            </div>
          </div>

          {/* ── the honesty note ───────────────────────────────────────── */}
          <div className="card pad" style={{ marginTop: 14, borderLeft: '3px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div className="eyebrow" style={{ color: 'var(--amber)' }}>
                Imputed token cost · notional
              </div>
              <span
                style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22, letterSpacing: '-.02em' }}
                className={board.totalImputed === null ? 'unk' : undefined}
              >
                {money(board.totalImputed)}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, maxWidth: '76ch' }}>
              This is what these tokens <em>would</em> cost at Anthropic list price — it is{' '}
              <b>not money you spent</b>. Claude Code bills against your subscription, so the marginal
              cost of a token is zero. It’s here because it’s the right number for pricing work and
              for deciding what’s worth productising. The <b>allocated</b> figure above is the real
              cash. The two are never added together.
            </p>

            <div style={{ marginTop: 14 }}>
              <label className="fl" style={{ marginTop: 0 }}>
                What the Claude subscription actually costs, per month
              </label>
              <SubscriptionInput current={board.subscriptionMonthly} />
              {board.subscriptionMonthly === null && (
                <p style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 6 }}>
                  Until this is set, allocated cost is genuinely unknown — so it reads “—”, not “$0”.
                </p>
              )}
            </div>
          </div>

          {/* ── unattributed ───────────────────────────────────────────── */}
          {board.unattributed > 0 && (
            <>
              <div className="shead">
                <h3>Needs attributing</h3>
                <span className="sample">{board.unattributed} session(s)</span>
              </div>
              <p className="dw-note" style={{ margin: '-6px 0 12px' }}>
                Claude ran somewhere the hub doesn’t recognise. It won’t guess who the work was for —
                say who, and the hours land on their ledger.
              </p>
              <div className="card pad">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>What</th>
                      <th>Where</th>
                      <th>Who</th>
                      <th className="num">Hours</th>
                      <th>Attribute to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.sessions
                      .filter((s) => !s.clientId && !s.ventureId)
                      .map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>
                            {s.summary ?? <span className="unk">No summary written</span>}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-4)' }}>
                            {s.repoName ?? s.cwd?.split(/[\\/]/).pop() ?? DASH}
                          </td>
                          <td>
                            <Avatar person={people?.byId[s.profileId]} />
                          </td>
                          <td className="num">{HOURS(s.workedHours)}</td>
                          <td>
                            <AssignSession sessionId={s.id} {...options} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── the log ────────────────────────────────────────────────── */}
          <div className="shead">
            <h3>Sessions</h3>
            <span className="sample">idle gaps over 15 min excluded</span>
          </div>
          <div className="card pad">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>For</th>
                  <th>Who</th>
                  <th className="num">Worked</th>
                  <th className="num">Tokens</th>
                  <th className="num">Imputed</th>
                  <th className="num">Labour</th>
                </tr>
              </thead>
              <tbody>
                {board.sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {s.summary ?? <span className="unk">No summary written</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
                        {fmtY(s.startedAt)}
                        {s.source === 'manual' ? ' · logged by hand' : s.model ? ` · ${s.model}` : ''}
                        {s.idleSeconds > 0 && ` · ${Math.round(s.idleSeconds / 60)}m idle excluded`}
                      </div>
                    </td>
                    <td>
                      {s.clientId ? (
                        <Link href={`/clients/${s.clientId}`}>{s.clientName}</Link>
                      ) : s.ventureId ? (
                        <Link href={`/builds/${s.ventureId}`}>{s.ventureName}</Link>
                      ) : (
                        <Chip tone="amber">unattributed</Chip>
                      )}
                    </td>
                    <td>
                      <Avatar person={people?.byId[s.profileId]} />
                    </td>
                    <td className="num">{HOURS(s.workedHours)}</td>
                    <td className="num" style={{ color: 'var(--ink-4)' }}>
                      {s.totalTokens ? num(s.totalTokens) : DASH}
                    </td>
                    <td className={`num${s.imputedCost === null ? ' unk' : ''}`} style={{ color: 'var(--amber)' }}>
                      {money(s.imputedCost)}
                    </td>
                    <td className={`num ${s.labourCost === null ? 'unk' : 'pos'}`}>{money(s.labourCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
