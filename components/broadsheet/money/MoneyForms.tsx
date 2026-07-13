'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '../Toast';
import { useModal } from '../useModal';

// Money entry.
//
// Two rules govern everything here:
//   1. Never fabricate. A blank field stays NULL and renders as "—". Nothing is
//      defaulted to zero, and no figure is estimated on the user's behalf.
//   2. Never double-count. A projected line is "potential"; once FreshBooks
//      books the actual, the line is REALIZED and drops out of potential. The
//      two are never summed together.

const KINDS = [
  ['client_deal', 'Client deal'],
  ['product', 'Product'],
  ['service_line', 'Service line'],
  ['internal_tooling', 'Internal tooling'],
  ['pricing', 'Pricing'],
  ['hire', 'Hire'],
  ['other', 'Other'],
] as const;

const STATUSES = ['idea', 'evaluating', 'committed', 'active', 'done', 'killed'] as const;

type Option = { id: string; name: string };

const parseMoney = (s: string): number | null => {
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/* ── propose a decision ──────────────────────────────────────────────────── */

/**
 * A decision is a report, not a row: the case for doing something, with what it
 * costs and what it's expected to bring in. Revenue and cost are optional — if
 * you don't know them yet, leave them blank and the ledger says "—".
 */
export function ProposeDecisionButton({ clients, ventures }: { clients: Option[]; ventures: Option[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('client_deal');
  const [cadence, setCadence] = useState<'one_time' | 'monthly'>('one_time');
  const [revenue, setRevenue] = useState('');
  const [cost, setCost] = useState('');
  const [summary, setSummary] = useState('');
  const [clientId, setClientId] = useState('');
  const [ventureId, setVentureId] = useState('');

  useModal(open, () => setOpen(false));

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          kind,
          client_id: clientId || null,
          venture_id: ventureId || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      // Attach money lines only for the figures actually supplied. A blank stays
      // absent from the ledger rather than becoming a zero line.
      const today = new Date().toISOString().slice(0, 10);
      const rev = parseMoney(revenue);
      const cst = parseMoney(cost);

      const line = (direction: 'revenue' | 'cost', amount: number) =>
        fetch('/api/money-lines', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            direction,
            cadence,
            amount,
            decision_id: body.id,
            client_id: clientId || null,
            venture_id: ventureId || null,
            category: direction === 'cost' ? 'general' : 'general',
            ...(cadence === 'one_time' ? { occurs_on: today } : { starts_on: today }),
          }),
        });

      const writes: Promise<Response>[] = [];
      if (rev !== null) writes.push(line('revenue', rev));
      if (cst !== null) writes.push(line('cost', cst));
      await Promise.all(writes);

      toast(`Decision proposed · ${title.trim()}`);
      setOpen(false);
      router.push(`/money/decisions/${body.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn mint" onClick={() => setOpen(true)}>
        + Propose decision
      </button>

      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)} role="presentation">
          <div className="modal" style={{ width: 'min(620px, 94vw)' }} role="dialog" aria-modal="true" aria-label="Propose decision" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Propose decision</div>
            <input
              className="inp full"
              style={{ marginTop: 8, fontSize: 16 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rent a dedicated office space"
              autoFocus
            />

            <div style={{ display: 'flex', gap: 24, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label className="fl">Category</label>
                <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {KINDS.map(([k, label]) => (
                    <button key={k} className={`tog${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="fl">Cadence</label>
                <div className="r" style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      ['one_time', 'One-time'],
                      ['monthly', 'Monthly'],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} className={`tog${cadence === v ? ' on' : ''}`} onClick={() => setCadence(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <label className="fl">Projected revenue · optional</label>
                <input
                  className="inp full"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder={cadence === 'monthly' ? '$ / mo' : '$'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="fl">Projected cost · optional</label>
                <input
                  className="inp full"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder={cadence === 'monthly' ? '$ / mo' : '$'}
                />
              </div>
            </div>
            <p className="dw-note" style={{ margin: '2px 0 6px' }}>
              Leave a figure blank if you don’t know it — the ledger shows “—”, not zero.
            </p>

            <label className="fl">Linked client · optional</label>
            <select className="inp full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="fl">Linked venture · optional</label>
            <select className="inp full" value={ventureId} onChange={(e) => setVentureId(e.target.value)}>
              <option value="">— none —</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <label className="fl">The case · report</label>
            <textarea
              className="inp full"
              style={{ minHeight: 110, resize: 'vertical', fontFamily: 'var(--body)' }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Why this decision? Options considered, trade-offs, expected outcome…"
            />

            {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 6 }}>{err}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn mint" disabled={!title.trim() || busy} onClick={() => void create()}>
                {busy ? 'Creating…' : 'Create decision →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── decision status ─────────────────────────────────────────────────────── */

export function DecisionStatusControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function move(next: string) {
    if (busy || next === status) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        toast(`Moved to ${next}`);
        router.refresh();
      } else {
        toast('Status change failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {STATUSES.map((s) => (
        <button key={s} className={`tog${status === s ? ' on' : ''}`} disabled={busy} onClick={() => void move(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

/* ── money lines on a decision ───────────────────────────────────────────── */

export function NewMoneyLineForm({
  decisionId,
  clientId,
  ventureId,
}: {
  decisionId: string;
  clientId: string | null;
  ventureId: string | null;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<'revenue' | 'cost'>('revenue');
  const [cadence, setCadence] = useState<'one_time' | 'monthly'>('one_time');
  const [amount, setAmount] = useState('');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('');
  const [confidence, setConfidence] = useState('100');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // A time-based cost can be expressed as hours × rate. When both are present
  // they define the amount; otherwise the typed amount stands.
  const h = parseMoney(hours);
  const r = parseMoney(rate);
  const timeCost = direction === 'cost' && h !== null && r !== null ? h * r : null;
  const effective = timeCost ?? parseMoney(amount);

  async function add() {
    if (effective === null || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const conf = Math.min(Math.max((parseMoney(confidence) ?? 100) / 100, 0.01), 1);

      const res = await fetch('/api/money-lines', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          direction,
          cadence,
          amount: effective,
          confidence: conf,
          decision_id: decisionId,
          client_id: clientId,
          venture_id: ventureId,
          memo: memo.trim() || null,
          ...(timeCost !== null
            ? { cost_basis: 'time', hours_per_period: h, hourly_rate: r }
            : {}),
          ...(cadence === 'one_time' ? { occurs_on: today } : { starts_on: today }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      setAmount('');
      setHours('');
      setRate('');
      setMemo('');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['revenue', 'cost'] as const).map((d) => (
          <button key={d} className={`tog${direction === d ? ' on' : ''}`} onClick={() => setDirection(d)}>
            {d}
          </button>
        ))}
        <span style={{ width: 12 }} />
        {(
          [
            ['one_time', 'One-time'],
            ['monthly', 'Monthly'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={`tog${cadence === v ? ' on' : ''}`} onClick={() => setCadence(v)}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="inp"
          style={{ flex: '1 1 120px' }}
          value={timeCost !== null ? String(timeCost) : amount}
          disabled={timeCost !== null}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={cadence === 'monthly' ? '$ / mo' : '$'}
        />
        {direction === 'cost' && (
          <>
            <input
              className="inp"
              style={{ flex: '1 1 90px' }}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="hours"
              title="Hours per period — feeds the capacity model"
            />
            <input
              className="inp"
              style={{ flex: '1 1 90px' }}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="$/hr"
            />
          </>
        )}
        <input
          className="inp"
          style={{ flex: '1 1 80px' }}
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          placeholder="% sure"
          title="Confidence — weights this line in the projection"
        />
        <input
          className="inp"
          style={{ flex: '2 1 160px' }}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="memo"
        />
        {/* Gate on the EFFECTIVE amount, not the raw input — entering hours ×
            rate computes the amount and must be enough to enable the button. */}
        <button className="btn mint sm" disabled={effective === null || busy} onClick={() => void add()}>
          {busy ? '…' : 'Add line'}
        </button>
      </div>

      {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{err}</p>}
    </div>
  );
}

/**
 * Realize a projected line against a real FreshBooks invoice.
 *
 * This is the anti-double-count hinge: the line's status must flip to
 * 'realized' so it leaves "potential" and the FreshBooks actual takes over.
 * Sending the invoice id alone would leave it 'open' and the money would be
 * counted twice.
 */
export function RealizeControl({ lineId, invoices }: { lineId: string; invoices: { fb_id: number; number: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!invoices.length) {
    return (
      <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }} title="FreshBooks isn't connected, so there are no invoices to realize against.">
        —
      </span>
    );
  }

  async function realize(fbId: string) {
    if (!fbId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/money-lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'realized', realized_by_fb_invoice_id: Number(fbId) }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="inp"
      style={{ fontSize: 12, padding: '5px 8px' }}
      disabled={busy}
      defaultValue=""
      onChange={(e) => void realize(e.target.value)}
    >
      <option value="">Realize…</option>
      {invoices.map((i) => (
        <option key={i.fb_id} value={i.fb_id}>
          {i.number ?? `#${i.fb_id}`}
        </option>
      ))}
    </select>
  );
}

export function DeleteLineButton({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(`/api/money-lines/${lineId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="tog"
      disabled={busy}
      onClick={() => {
        if (confirm) void del();
        else {
          setConfirm(true);
          setTimeout(() => setConfirm(false), 4000);
        }
      }}
      style={confirm ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
    >
      {confirm ? 'Sure?' : 'Remove'}
    </button>
  );
}
