'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Initiative } from '@/lib/board';
import { useWorkspace } from '../WorkspaceProvider';
import { useToast } from '../Toast';
import { useModal } from '../useModal';

const LANES = ['Client', 'Product', 'Service', 'Ops'] as const;
const STATUSES = ['idea', 'evaluating', 'active', 'paused', 'shipped'] as const;

type Option = { id: string; name: string };

/* ── new initiative ──────────────────────────────────────────────────────── */

export function NewInitiativeButton({
  clients,
  builds,
  repos,
}: {
  clients: Option[];
  builds: Option[];
  repos: Option[];
}) {
  const router = useRouter();
  const { me, people } = useWorkspace();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [owner, setOwner] = useState(me);
  const [lane, setLane] = useState<(typeof LANES)[number]>('Client');
  const [clientId, setClientId] = useState('');
  const [ventureId, setVentureId] = useState('');
  const [repoId, setRepoId] = useState('');

  useModal(open, () => setOpen(false));

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          why: why.trim() || null,
          owner_id: people[owner].id,
          lane,
          client_id: clientId || null,
          venture_id: ventureId || null,
          repo_id: repoId || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast(`Initiative added · ${title.trim()}`);
      setOpen(false);
      setTitle('');
      setWhy('');
      router.push(`/initiatives/${body.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn mint" onClick={() => setOpen(true)}>
        + New initiative
      </button>

      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="New initiative" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">New initiative</div>
            <h3 style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, margin: '6px 0 16px' }}>
              Add a bet to the backlog
            </h3>

            <label className="fl">Title</label>
            <input
              className="inp full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Roll the video pipeline out to a second trade client"
              autoFocus
            />

            <label className="fl">Why it matters</label>
            <input
              className="inp full"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="One line of context"
            />

            <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
              <div>
                <label className="fl">Owner</label>
                <div className="r" style={{ display: 'flex', gap: 6 }}>
                  {(['joe', 'josh'] as const).map((o) => (
                    <button key={o} className={`tog${owner === o ? ' on' : ''}`} onClick={() => setOwner(o)}>
                      {people[o].first}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="fl">Lane</label>
                <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {LANES.map((l) => (
                    <button key={l} className={`tog${lane === l ? ' on' : ''}`} onClick={() => setLane(l)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Links are what let the board derive an initiative's status from
                real repo and client activity instead of asking for updates. */}
            <label className="fl">Linked client</label>
            <select className="inp full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— none (internal) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="fl">Linked build</label>
            <select className="inp full" value={ventureId} onChange={(e) => setVentureId(e.target.value)}>
              <option value="">— none —</option>
              {builds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <label className="fl">Linked repo · its commits become this initiative’s signal</label>
            <select className="inp full" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
              <option value="">— none —</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 10 }}>{err}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn mint" disabled={!title.trim() || busy} onClick={() => void create()}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── decisions log ───────────────────────────────────────────────────────── */

/**
 * Most status on this board is derived automatically from repo signal. This is
 * the one place a human writes something down — so it only takes the calls you
 * actually made, and it's append-only.
 */
export function DecisionLogForm({ initiativeId }: { initiativeId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function log() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/initiatives/${initiativeId}/decisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        toast('Decision logged');
        setDraft('');
        router.refresh();
      } else {
        toast('Couldn’t log that decision');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="addrow">
      <input
        className="inp"
        placeholder="Log a decision…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void log()}
      />
      <button className="btn mint sm" disabled={!draft.trim() || busy} onClick={() => void log()}>
        {busy ? '…' : 'Log'}
      </button>
    </div>
  );
}

/* ── detail controls ─────────────────────────────────────────────────────── */

export function InitiativeControls({ initiative }: { initiative: Initiative }) {
  const router = useRouter();
  const { people, peopleById } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(initiative.blockNote ?? '');

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast('Initiative updated');
        router.refresh();
      } else {
        toast('Update failed — nothing was saved');
      }
    } finally {
      setBusy(false);
    }
  }

  const blockedKey = initiative.blockedOnExternal
    ? 'external'
    : (initiative.blockedOnProfileId ?? 'none');

  return (
    <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="eyebrow">Update</div>

      <label className="fl">Status</label>
      <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`tog${initiative.status === s ? ' on' : ''}`}
            disabled={busy}
            onClick={() => void patch({ status: s })}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="fl">Health</label>
      <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['green', 'yellow', 'red'] as const).map((h) => (
          <button
            key={h}
            className={`tog${initiative.health === h ? ' on' : ''}`}
            disabled={busy}
            onClick={() => void patch({ health: initiative.health === h ? null : h })}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Progress is a judgement call, not a computed figure — it's set by hand
          and the UI says so rather than implying it was measured. */}
      <label className="fl">Progress · hand-set</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          defaultValue={Math.round(initiative.progress * 100)}
          disabled={busy}
          style={{ flex: 1, accentColor: 'var(--mint)' }}
          onMouseUp={(e) => void patch({ progress: Number((e.target as HTMLInputElement).value) / 100 })}
          onTouchEnd={(e) => void patch({ progress: Number((e.target as HTMLInputElement).value) / 100 })}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', minWidth: 38 }}>
          {Math.round(initiative.progress * 100)}%
        </span>
      </div>

      <label className="fl">Blocked on</label>
      <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className={`tog${blockedKey === 'none' ? ' on' : ''}`}
          disabled={busy}
          onClick={() => void patch({ blocked_on: 'none' })}
        >
          Nobody
        </button>
        {(['joe', 'josh'] as const).map((k) => (
          <button
            key={k}
            className={`tog${blockedKey === people[k].id ? ' on' : ''}`}
            disabled={busy}
            onClick={() => void patch({ blocked_on: people[k].id })}
          >
            {people[k].first}
          </button>
        ))}
        <button
          className={`tog${blockedKey === 'external' ? ' on' : ''}`}
          disabled={busy}
          onClick={() => void patch({ blocked_on: 'external' })}
        >
          Client
        </button>
      </div>

      {blockedKey !== 'none' && (
        <>
          <label className="fl">Why it’s blocked</label>
          <div className="addrow">
            <input
              className="inp"
              value={note}
              placeholder="What exactly is it waiting on?"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void patch({ block_note: note })}
            />
            <button className="btn ghost sm" disabled={busy} onClick={() => void patch({ block_note: note })}>
              Save
            </button>
          </div>
        </>
      )}

      <label className="fl">Owner</label>
      <div className="r" style={{ display: 'flex', gap: 6 }}>
        {(['joe', 'josh'] as const).map((k) => (
          <button
            key={k}
            className={`tog${peopleById[initiative.ownerId]?.key === k ? ' on' : ''}`}
            disabled={busy}
            onClick={() => void patch({ owner_id: people[k].id })}
          >
            {people[k].first}
          </button>
        ))}
      </div>
    </div>
  );
}
