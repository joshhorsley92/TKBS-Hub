'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useModal } from '../useModal';

// Every write surface on the Clients screens. These are the only places a human
// puts a fact into the client record — which is why each one writes a real row
// and then re-fetches, rather than optimistically painting a value the database
// might have rejected.

const STAGES = ['prospect', 'discovery', 'proposal', 'active', 'paused', 'past'] as const;
const HEALTH = ['green', 'yellow', 'red'] as const;

type Stage = (typeof STAGES)[number];

/* ── add client ──────────────────────────────────────────────────────────── */

export function AddClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Add client
      </button>
      {open && (
        <NewClientModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [engagement, setEngagement] = useState('');
  const [since, setSince] = useState('');
  const [stage, setStage] = useState<Stage>('prospect');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Blank fields are sent as-is and the route nulls them out. An empty
      // input means "we don't know yet", and it has to reach the database as
      // NULL — not as an empty string that would later read as a known blank.
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          stage,
          industry,
          website,
          engagement,
          since,
          contact_name: contactName,
          contact_email: contactEmail,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      onCreated();
    } catch {
      setError('Could not reach the hub.');
    } finally {
      setBusy(false);
    }
  }

  useModal(true, onClose);

  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="New client" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">New client</div>
        <h3 style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, margin: '6px 0 16px' }}>
          Put a client on the board
        </h3>

        <label className="fl" style={{ marginTop: 0 }}>
          Name
        </label>
        <input
          className="inp full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Detroit Bikes"
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="fl">Industry</label>
            <input
              className="inp full"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="fl">Website</label>
            <input
              className="inp full"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="fl">Contact name</label>
            <input
              className="inp full"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="fl">Contact email</label>
            <input
              className="inp full"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 2 }}>
            {/* Engagement is what we do for them, in words — never a price. */}
            <label className="fl">Engagement</label>
            <input
              className="inp full"
              value={engagement}
              onChange={(e) => setEngagement(e.target.value)}
              placeholder="e.g. Launch → Boost"
            />
          </div>
          <div style={{ flex: 1 }}>
            {/* Sets where the life-line starts. Left blank, it starts the day the row was created. */}
            <label className="fl">Client since</label>
            <input
              className="inp full"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
        </div>

        <label className="fl">Stage</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map((s) => (
            <button key={s} className={`tog${stage === s ? ' on' : ''}`} onClick={() => setStage(s)}>
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn mint" onClick={() => void create()} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── stage + health ──────────────────────────────────────────────────────── */

/**
 * The two fields a human sets by hand on a client. Health drives "Needs
 * deciding" on the Pulse, so setting it yellow/red is how a worry gets onto the
 * board — and "not set" stays selectable, because unknown health is a real
 * state, not a green one.
 */
export function StageHealthControls({
  id,
  stage,
  health,
}: {
  id: string;
  stage: string;
  health: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      });
      // The route logs stage/health changes to client_events, so a successful
      // write also adds a dot to the life-line. Refresh to pick both up.
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
      <div>
        <div className="fl" style={{ margin: '0 0 7px' }}>
          Stage
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map((s) => (
            <button
              key={s}
              className={`tog${s === stage ? ' on' : ''}`}
              disabled={busy}
              onClick={() => s !== stage && void patch({ stage: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="fl" style={{ margin: '0 0 7px' }}>
          Health
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`tog${health === null ? ' on' : ''}`}
            disabled={busy}
            onClick={() => health !== null && void patch({ health: null })}
          >
            not set
          </button>
          {HEALTH.map((h) => (
            <button
              key={h}
              className={`tog${h === health ? ' on' : ''}`}
              disabled={busy}
              onClick={() => h !== health && void patch({ health: h })}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── note ────────────────────────────────────────────────────────────────── */

/**
 * Appends a `client_events` row. Until FreshBooks and the calendar are wired,
 * this and the commits in a client's repos are the only things that move a
 * life-line — so a note here is the main way the record grows.
 */
export function ClientNoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (res.ok) {
        setNote('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="addrow" style={{ marginTop: 10 }}>
      <input
        className="inp"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened?"
        disabled={busy}
      />
      <button className="btn sm" type="submit" disabled={busy || !note.trim()}>
        Log
      </button>
    </form>
  );
}

/* ── FreshBooks mapping ──────────────────────────────────────────────────── */

export type FbClientOption = { fb_id: number; label: string };

/** Ties a hub client to its FreshBooks account so synced invoices attribute here. */
export function FbMapping({
  clientId,
  current,
  options,
}: {
  clientId: string;
  current: number | null;
  options: FbClientOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function map(value: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fb_client_id: value ? Number(value) : null }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="inp full"
      style={{ marginTop: 10 }}
      value={current ?? ''}
      disabled={busy}
      onChange={(e) => void map(e.target.value)}
    >
      <option value="">not mapped</option>
      {options.map((o) => (
        <option key={o.fb_id} value={o.fb_id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
