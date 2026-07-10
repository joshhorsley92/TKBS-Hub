'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

const KINDS = ['client_deal', 'product', 'service_line', 'internal_tooling', 'hire', 'pricing', 'other'] as const;
const STATUSES = ['idea', 'evaluating', 'committed', 'active', 'done', 'killed'] as const;

const inputCls =
  'rounded-console border border-edge bg-panel-2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink outline-none placeholder:text-ink-5 focus:border-mint';

// New-decision form (inline on /money).
export function NewDecisionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<string>('other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), kind }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? `HTTP ${res.status}`);
    else {
      setTitle('');
      setOpen(false);
      router.push(`/money/decisions/${body.id}`);
      router.refresh();
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 rounded-console border border-edge bg-panel-2 px-2.5 py-1 font-mono text-[10.5px] tracking-wider text-ink-3 transition hover:border-mint hover:text-mint"
      >
        <Plus size={11} /> PROPOSE DECISION
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      {error && <span className="font-mono text-[10.5px] text-danger">{error}</span>}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="what's the decision?"
        disabled={busy}
        className={`w-[280px] ${inputCls}`}
      />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
        {KINDS.map((k) => (
          <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
        ))}
      </select>
      <button type="submit" disabled={busy} className="cursor-pointer rounded-console bg-mint px-3 py-1.5 font-heading text-[11px] font-semibold text-bg transition hover:bg-mint-dark disabled:opacity-50">
        {busy ? '…' : 'PROPOSE'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-ink-4 hover:text-ink-2">
        <X size={13} />
      </button>
    </form>
  );
}

// Decision lifecycle controls ("Joe proposes, Josh decides" — committing
// stamps the decider).
export function DecisionStatusControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(next: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/decisions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="p-label mr-1">Status</span>
      {STATUSES.map((s) => (
        <button
          key={s}
          disabled={busy}
          onClick={() => s !== status && move(s)}
          className={`cursor-pointer rounded-console px-2 py-0.5 font-mono text-[10px] tracking-wider transition ${
            s === status
              ? s === 'killed'
                ? 'bg-panel-2 text-danger'
                : s === 'active' || s === 'done'
                  ? 'bg-panel-2 text-actual'
                  : s === 'committed'
                    ? 'bg-panel-2 text-commit-2'
                    : 'bg-panel-2 text-mint'
              : 'text-ink-4 hover:text-ink-2'
          }`}
        >
          {s.toUpperCase()}
        </button>
      ))}
      {error && <span className="font-mono text-[10.5px] text-danger">{error}</span>}
    </div>
  );
}

// Add a projected money line to a decision. Cost lines can carry a
// time-basis (hours/mo × rate) — that's what feeds the capacity model.
export function NewLineForm({
  decisionId,
  profiles = [],
}: {
  decisionId: string;
  profiles?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [direction, setDirection] = useState('revenue');
  const [cadence, setCadence] = useState('monthly');
  const [amount, setAmount] = useState('');
  const [confidence, setConfidence] = useState('1.0');
  const [memo, setMemo] = useState('');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTimeCost = direction === 'cost' && hours !== '';
  const computedAmount = isTimeCost && rate !== '' ? Number(hours) * Number(rate) : null;
  const effectiveAmount = computedAmount ?? (amount ? Number(amount) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (effectiveAmount == null || !Number.isFinite(effectiveAmount)) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/money-lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_id: decisionId,
        direction,
        cadence,
        amount: effectiveAmount,
        confidence: Number(confidence),
        memo: memo.trim() || null,
        ...(isTimeCost
          ? {
              cost_basis: 'time',
              hours_per_period: Number(hours),
              hourly_rate: rate ? Number(rate) : null,
              assignee_id: assignee || null,
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
    } else {
      setAmount('');
      setMemo('');
      setHours('');
      setRate('');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputCls}>
        <option value="revenue">revenue</option>
        <option value="cost">cost</option>
      </select>
      <select value={cadence} onChange={(e) => setCadence(e.target.value)} className={inputCls}>
        <option value="monthly">monthly</option>
        <option value="one_time">one-time</option>
      </select>
      <input
        value={computedAmount != null ? String(computedAmount) : amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="$ amount"
        inputMode="decimal"
        disabled={busy || computedAmount != null}
        title={computedAmount != null ? 'computed from hours × rate' : undefined}
        className={`w-[100px] ${inputCls}`}
      />
      {direction === 'cost' && (
        <>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="hrs/mo"
            inputMode="decimal"
            disabled={busy}
            title="time-basis: hours per period (feeds the capacity model)"
            className={`w-[70px] ${inputCls}`}
          />
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="$/hr"
            inputMode="decimal"
            disabled={busy}
            className={`w-[70px] ${inputCls}`}
          />
          {profiles.length > 0 && hours !== '' && (
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls} title="whose hours">
              <option value="">whose hours?</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>
              ))}
            </select>
          )}
        </>
      )}
      <label className="flex items-center gap-1.5 font-mono text-[10px] text-ink-4">
        CONF
        <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className={inputCls}>
          <option value="1.0">100%</option>
          <option value="0.9">90%</option>
          <option value="0.75">75%</option>
          <option value="0.5">50%</option>
          <option value="0.25">25%</option>
        </select>
      </label>
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="memo (optional)"
        disabled={busy}
        className={`w-[200px] ${inputCls}`}
      />
      <button type="submit" disabled={busy || !amount} className="cursor-pointer rounded-console border border-edge bg-panel-2 px-2.5 py-1.5 font-mono text-[10.5px] tracking-wider text-ink-3 transition hover:border-mint hover:text-mint disabled:opacity-50">
        + LINE
      </button>
      {error && <span className="font-mono text-[10.5px] text-danger">{error}</span>}
    </form>
  );
}

// Remove / cancel a line.
export function LineActions({ id }: { id: string }) {
  const router = useRouter();
  async function del() {
    await fetch(`/api/money-lines/${id}`, { method: 'DELETE' });
    router.refresh();
  }
  return (
    <button onClick={del} title="delete line" className="cursor-pointer text-ink-5 transition hover:text-danger">
      <X size={12} />
    </button>
  );
}
