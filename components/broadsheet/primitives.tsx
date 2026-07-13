// Shared presentational primitives for the Broadsheet console.
// Server-safe (no hooks) except where explicitly a client component.

import type { CSSProperties, ReactNode } from 'react';
import {
  DASH,
  LIFE_TYPE_COLOR,
  type LifeEventLike,
  type Person,
  SRC_LABEL,
  fmt,
  fmtY,
  money,
} from '@/lib/broadsheet';

/* ── avatar ──────────────────────────────────────────────────────────────── */

export function Avatar({ person, cls = 'avatar' }: { person: Person | null | undefined; cls?: string }) {
  if (!person) return null;
  return (
    <span className={cls} style={{ background: person.color }} title={person.name}>
      {person.initials}
    </span>
  );
}

/* ── chip ────────────────────────────────────────────────────────────────── */

type Tone = 'mint' | 'amber' | 'blue' | 'violet' | '';

export function Chip({
  children,
  tone = '',
  style,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <span className={`chip ${tone}`.trim()} style={style} title={title}>
      {children}
    </span>
  );
}

/* ── empty state ─────────────────────────────────────────────────────────── */
// The console renders unknowns as unknowns. Every empty surface says what would
// fill it and what it's waiting on — it never pads itself out with a fake row.

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="es-t">{title}</div>
      <div className="es-s">{children}</div>
      {action}
    </div>
  );
}

/* ── section header ──────────────────────────────────────────────────────── */

export function SHead({
  title,
  right,
  style,
}: {
  title: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="shead" style={style}>
      <h3>{title}</h3>
      {right}
    </div>
  );
}

/* ── progress bar ────────────────────────────────────────────────────────── */

export function Progress({ value, health, style }: { value: number; health?: string | null; style?: CSSProperties }) {
  return (
    <div className="prog" style={style}>
      <i
        style={{
          width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`,
          background: health === 'yellow' ? 'var(--amber)' : health === 'red' ? 'var(--danger)' : 'var(--mint)',
        }}
      />
    </div>
  );
}

/* ── projection bars ─────────────────────────────────────────────────────── */

export type BarPoint = { month: string; actual: number; potential: number };

/**
 * Six-month stacked bars. Actual (ink) and potential (accent) are stacked but
 * never summed into one figure — the anti-double-count rule is visual here too.
 * With an empty ledger every bar is zero-height, which is the honest picture.
 */
export function Bars({ data, height = 76 }: { data: BarPoint[]; height?: number }) {
  const max = Math.max(1, ...data.map((m) => m.actual + m.potential));
  const empty = data.every((m) => m.actual + m.potential === 0);

  return (
    <div className="bars" style={{ height: height + 20 }}>
      {data.map((m) => {
        const total = m.actual + m.potential;
        const h = total === 0 ? 2 : (total / max) * height;
        return (
          <div key={m.month} className="col">
            <div
              className="stack"
              style={{ height: `${h}px`, background: empty ? 'var(--line)' : undefined }}
              title={empty ? 'Nothing on the books' : `${money(m.actual)} actual · ${money(m.potential)} potential`}
            >
              {total > 0 && (
                <>
                  <div className="p" style={{ height: `${(m.potential / total) * 100}%` }} />
                  <div className="r" style={{ height: `${(m.actual / total) * 100}%` }} />
                </>
              )}
            </div>
            <span className="lab">{m.month}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── life-line ───────────────────────────────────────────────────────────── */

/**
 * A client relationship, drawn as a horizontal time-line. Assembled from real
 * records only — entry date, logged notes, commits in their repos, invoices,
 * and what's scheduled next. A brand-new client is a single dot, and that's
 * the correct rendering.
 */
export function LifeLine({
  events,
  peopleById,
}: {
  events: LifeEventLike[];
  peopleById: Record<string, Person>;
}) {
  if (!events.length) {
    return <div className="empty-inline">No recorded activity yet.</div>;
  }

  const now = Date.now();
  const times = events.map((e) => new Date(e.d).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times, now);
  const span = Math.max(max - min, 1);
  const pos = (d: string) => 4 + ((new Date(d).getTime() - min) / span) * 92;

  return (
    <div className="track">
      <div className="base" />
      {events.map((e, i) => {
        const color = LIFE_TYPE_COLOR[e.type] ?? '#9aa6b8';
        const above = i % 2 === 0;
        const p = pos(e.d);
        const side = p > 75 ? 'left' : p < 25 ? 'right' : 'mid';
        const who = e.by ? peopleById[e.by] : null;

        return (
          <div
            key={`${e.d}-${i}`}
            className={`node scrub${e.flag ? ' hi' : ''}`}
            style={{ left: `${p}%`, color }}
          >
            <div className={`node-pop ${side}`}>
              <div className="np-d">
                {fmtY(e.d)}
                {who ? ` · ${who.first}` : ''}
                {e.amt != null ? ` · ${money(e.amt)}` : ''}
              </div>
              <div className="np-t">{e.t}</div>
              <div className="np-s">{SRC_LABEL[e.src] ?? ''}</div>
            </div>
            <div className="dotw">
              <span
                className={`dot${e.type === 'upcoming' ? ' up' : e.type === 'enter' ? ' hollow' : ''}`}
              />
            </div>
            <div className={`lbl ${above ? 'above' : 'below'}`}>
              <span className="dte">{fmt(e.d)}</span>
              {e.t}
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${pos(new Date().toISOString())}%`,
          width: 1,
          background: 'var(--mint)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

/* ── money trio (client card) ────────────────────────────────────────────── */

export function MoneyTrio({
  revenue,
  cost,
  potential,
  freshbooksConnected,
}: {
  revenue: number | null;
  cost: number | null;
  potential: number | null;
  freshbooksConnected: boolean;
}) {
  const hint = freshbooksConnected
    ? 'Revenue and cost from FreshBooks; potential from the planning ledger.'
    : 'FreshBooks is not connected — revenue and cost are unknown, not zero.';

  return (
    <div className="rt cval" title={hint}>
      <div>
        <b className={revenue == null ? 'unk' : 'pos'}>{money(revenue)}</b>
        <span>revenue</span>
      </div>
      <div>
        <b className={cost == null ? 'unk' : undefined}>{money(cost)}</b>
        <span>cost</span>
      </div>
      <div>
        <b className={potential == null ? 'unk' : undefined} style={potential != null ? { color: 'var(--mint-ink)' } : undefined}>
          {potential == null ? DASH : `${money(potential)}/mo`}
        </b>
        <span>potential</span>
      </div>
    </div>
  );
}
