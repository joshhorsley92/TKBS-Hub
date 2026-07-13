'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useModal } from '../useModal';
import { useWorkspace } from '../WorkspaceProvider';
import { useToast } from '../Toast';

type Option = { id: string; name: string };

/* ── assign an unattributed session ──────────────────────────────────────── */

/**
 * Claude ran somewhere the hub didn't recognise. Rather than guess a client, the
 * session sits here and a human says who it was for.
 */
export function AssignSession({
  sessionId,
  suggestion,
  clients,
  ventures,
}: {
  sessionId: string;
  /** What the work LOOKS like it was for, read from the session's own prompts.
   *  Offered for one-click confirmation — never applied on its own. */
  suggestion: { id: string; name: string } | null;
  clients: Option[];
  ventures: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function apply(body: Record<string, string>, label: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/time/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast(`Attributed to ${label}`);
        router.refresh();
      } else {
        toast('Couldn’t attribute that session');
      }
    } finally {
      setBusy(false);
    }
  }

  async function assign(value: string) {
    if (!value) return;
    const [kind, id] = value.split(':');
    const name =
      (kind === 'client' ? clients : ventures).find((o) => o.id === id)?.name ?? 'that';
    await apply(kind === 'client' ? { client_id: id } : { venture_id: id }, name);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* The repo couldn't say who this was for, so Claude read the session's
          own prompts and named a client. It's a suggestion — a human presses
          the button. Nothing is booked to a client on a guess. */}
      {suggestion && (
        <button
          className="btn mint sm"
          disabled={busy}
          title="Inferred from this session’s prompts. Confirm to attribute it."
          onClick={() => void apply({ client_id: suggestion.id }, suggestion.name)}
        >
          ✓ {suggestion.name}?
        </button>
      )}
      <select
        className="inp"
        style={{ fontSize: 12, padding: '5px 8px' }}
        disabled={busy}
        defaultValue=""
        aria-label="Attribute this session to a client or build"
        onChange={(e) => void assign(e.target.value)}
      >
        <option value="">{suggestion ? 'or choose…' : 'Assign…'}</option>
        {clients.length > 0 && (
          <optgroup label="Clients">
            {clients.map((c) => (
              <option key={c.id} value={`client:${c.id}`}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {ventures.length > 0 && (
          <optgroup label="Builds · internal">
            {ventures.map((v) => (
              <option key={v.id} value={`venture:${v.id}`}>
                {v.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

/* ── the subscription figure ─────────────────────────────────────────────── */

/**
 * The one number that turns notional token cost into real cash. Until it's set,
 * allocated cost is genuinely unknown, and the board says so.
 */
export function SubscriptionInput({ current }: { current: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(current === null ? '' : String(current));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const cleaned = value.replace(/[^0-9.]/g, '');
      const res = await fetch('/api/assumptions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'claude_subscription_monthly',
          // Blank means "we don't know" — store null, never zero.
          value: cleaned ? Number(cleaned) : null,
        }),
      });
      if (res.ok) {
        toast(cleaned ? 'Subscription cost saved' : 'Subscription cost cleared');
        router.refresh();
      } else {
        toast('Couldn’t save that');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="addrow" style={{ maxWidth: 340 }}>
      <input
        className="inp"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="$ / month"
        aria-label="Monthly Claude subscription cost"
        onKeyDown={(e) => e.key === 'Enter' && void save()}
      />
      <button className="btn ghost sm" disabled={busy} onClick={() => void save()}>
        {busy ? '…' : 'Save'}
      </button>
    </div>
  );
}

/* ── manual entry ────────────────────────────────────────────────────────── */

/**
 * Claude-session tracking only sees work done inside Claude Code. A sales call,
 * an hour in FreshBooks, a design review — those generate no events at all, so
 * they get logged by hand. Without this, the board would only ever see Joe.
 */
export function LogTimeButton({ clients, ventures }: { clients: Option[]; ventures: Option[] }) {
  const router = useRouter();
  const toast = useToast();
  const { me, roster } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meId = roster.find((p) => p.key === me)?.id ?? '';
  const [who, setWho] = useState('');
  const [hours, setHours] = useState('');
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');

  useModal(open, () => setOpen(false));

  const profileId = who || meId;
  const parsedHours = Number(hours.replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(parsedHours) && parsedHours > 0 && Boolean(note.trim());

  async function create() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const [kind, id] = target ? target.split(':') : [];
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          worked_seconds: Math.round(parsedHours * 3600),
          started_at: new Date(`${when}T09:00:00`).toISOString(),
          summary: note.trim(),
          client_id: kind === 'client' ? id : null,
          venture_id: kind === 'venture' ? id : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast(`Logged ${parsedHours}h`);
      setOpen(false);
      setHours('');
      setNote('');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn mint" onClick={() => setOpen(true)}>
        + Log time
      </button>

      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)} role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Log time"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eyebrow">Log time</div>
            <h3 style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, margin: '6px 0 4px' }}>
              Work that didn’t happen in Claude
            </h3>
            <p className="dw-note" style={{ margin: '0 0 12px' }}>
              Claude sessions track themselves. Calls, meetings, bookkeeping and design don’t — log
              those here or they never reach the board.
            </p>

            <label className="fl">Who</label>
            <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {roster.map((p) => (
                <button
                  key={p.key}
                  className={`tog${profileId === p.id ? ' on' : ''}`}
                  onClick={() => setWho(p.id)}
                >
                  {p.first}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="fl">Hours</label>
                <input
                  className="inp full"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 1.5"
                  autoFocus
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="fl">Date</label>
                <input
                  className="inp full"
                  type="date"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            </div>

            <label className="fl">For</label>
            <select className="inp full" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— unattributed —</option>
              <optgroup label="Clients">
                {clients.map((c) => (
                  <option key={c.id} value={`client:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Builds · internal">
                {ventures.map((v) => (
                  <option key={v.id} value={`venture:${v.id}`}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            </select>

            <label className="fl">What was it</label>
            <input
              className="inp full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Discovery call with Rooted Landscaping"
            />

            {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{err}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn mint" disabled={!valid || busy} onClick={() => void create()}>
                {busy ? 'Logging…' : 'Log time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
