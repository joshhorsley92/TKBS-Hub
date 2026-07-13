'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DASH } from '@/lib/broadsheet';
import { useModal } from '../useModal';

// The three write-paths on a build. Each one exists because the value it edits
// has NO automatic source — a person is the source, and the copy says so.
//
//  · LinkClientControl — writes build_deployments. The reuse map is empty on day
//    one because the table is empty; this is how it stops being empty.
//  · LinkRepoControl   — writes repos.venture_id. This is how real commits start
//    rolling up into a build instead of floating unattached.
//  · EngHoursControl   — writes ventures.eng_hours. Hand-entered, always. The hub
//    will never estimate it; blank stays "—".

export type ClientOpt = { id: string; name: string };
export type RepoOpt = { id: string; name: string; org: string };
export type DeploymentLink = {
  clientId: string;
  clientName: string;
  status: 'deployed' | 'candidate';
};

/* ── shared shell ────────────────────────────────────────────────────────── */

function Modal({ title, note, onClose, children }: { title: string; note?: string; onClose: () => void; children: ReactNode }) {
  useModal(true, onClose);
  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="shead" style={{ margin: '0 0 6px' }}>
          <h3>{title}</h3>
          <button className="cp-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {note && <p className="dw-note" style={{ margin: '0 0 4px' }}>{note}</p>}
        {children}
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }} role="alert">
      {msg}
    </p>
  );
}

/* ── deployments ─────────────────────────────────────────────────────────── */

export function LinkClientControl({
  ventureId,
  clients,
  links,
  label = '+ Link a client',
}: {
  ventureId: string;
  clients: ClientOpt[];
  links: DeploymentLink[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<'deployed' | 'candidate'>('deployed');
  const [role, setRole] = useState('');
  const [since, setSince] = useState(new Date().toISOString().slice(0, 10));

  async function save() {
    if (!clientId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/build-deployments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          venture_id: ventureId,
          client_id: clientId,
          status,
          role: role.trim() || null,
          // A candidate has no start date — it hasn't happened.
          since: status === 'deployed' ? since : null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setOpen(false);
      setClientId('');
      setRole('');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/build-deployments?venture_id=${ventureId}&client_id=${id}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>
        {label}
      </button>

      {open && (
        <Modal
          title="Link a client to this build"
          note="A deployment says this build is actually serving that client. A candidate says it could — nothing is assumed."
          onClose={() => setOpen(false)}
        >
          {clients.length === 0 ? (
            <p className="empty-inline">There are no clients on the board to link to yet.</p>
          ) : (
            <>
              <label className="fl">Client</label>
              <select className="inp full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <label className="fl">Status</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`tog${status === 'deployed' ? ' on' : ''}`}
                  onClick={() => setStatus('deployed')}
                >
                  Deployed
                </button>
                <button
                  className={`tog${status === 'candidate' ? ' on' : ''}`}
                  onClick={() => setStatus('candidate')}
                >
                  Candidate
                </button>
              </div>

              <label className="fl">Role — optional</label>
              <input
                className="inp full"
                placeholder="e.g. fixture — the client that proved it out"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />

              {status === 'deployed' && (
                <>
                  <label className="fl">Deployed since</label>
                  <input className="inp full" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
                </>
              )}

              <Err msg={err} />

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn mint" onClick={() => void save()} disabled={!clientId || busy}>
                  {busy ? 'Saving…' : 'Link client'}
                </button>
                <button className="btn ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {links.length > 0 && (
            <>
              <label className="fl">Currently linked</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {links.map((l) => (
                  <div key={l.clientId} className="la-tk" style={{ gap: 10 }}>
                    <span className="la-tt">{l.clientName}</span>
                    <span className={`reuse-pill ${l.status === 'deployed' ? 'deployed' : 'cand'}`}>{l.status}</span>
                    <button
                      className="cp-x"
                      title={`Unlink ${l.clientName}`}
                      disabled={busy}
                      onClick={() => void remove(l.clientId)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

/* ── repo mapping ────────────────────────────────────────────────────────── */

export function LinkRepoControl({
  ventureId,
  linked,
  available,
  label = '+ Link a repo',
}: {
  ventureId: string;
  linked: RepoOpt[];
  available: RepoOpt[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repoId, setRepoId] = useState('');

  async function map(id: string, ventureOrNull: string | null) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/repos/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ venture_id: ventureOrNull }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setRepoId('');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>
        {label}
      </button>

      {open && (
        <Modal
          title="Map a repo to this build"
          note="Commits are already ingested from GitHub — they just aren’t attributed to anything yet. Mapping a repo here is what makes its real commits show up as this build’s activity."
          onClose={() => setOpen(false)}
        >
          {available.length === 0 ? (
            <p className="empty-inline">Every active repo is already mapped to a build.</p>
          ) : (
            <>
              <label className="fl">Repo</label>
              <select className="inp full" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
                <option value="">Choose a repo…</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.org}/{r.name}
                  </option>
                ))}
              </select>
              <Err msg={err} />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn mint" onClick={() => void map(repoId, ventureId)} disabled={!repoId || busy}>
                  {busy ? 'Saving…' : 'Link repo'}
                </button>
                <button className="btn ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {linked.length > 0 && (
            <>
              <label className="fl">Mapped to this build</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linked.map((r) => (
                  <div key={r.id} className="la-tk" style={{ gap: 10 }}>
                    <span className="la-tt" style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
                      {r.org}/{r.name}
                    </span>
                    <button
                      className="cp-x"
                      title={`Unmap ${r.name}`}
                      disabled={busy}
                      onClick={() => void map(r.id, null)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

/* ── engineering hours ───────────────────────────────────────────────────── */

export function EngHoursControl({
  ventureId,
  engHours,
  blurb,
}: {
  ventureId: string;
  engHours: number | null;
  blurb: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hours, setHours] = useState(engHours == null ? '' : String(engHours));
  const [text, setText] = useState(blurb ?? '');

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // Blank means "we still don't know" — it clears the field back to null
          // rather than becoming a zero.
          eng_hours: hours.trim() === '' ? null : Number(hours),
          blurb: text,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn ghost sm"
        style={{ marginTop: 8 }}
        onClick={() => setOpen(true)}
        title="Engineering hours are hand-entered — the hub has no source for them"
      >
        {engHours == null ? 'Enter hours' : 'Edit hours'}
      </button>

      {open && (
        <Modal
          title="Engineering invested"
          note="Hand-entered. Nothing in the hub can measure this — GitHub knows commits, not hours, and FreshBooks time tracking isn’t wired. Leave it blank and it stays “—”; the board will not guess."
          onClose={() => setOpen(false)}
        >
          <label className="fl">Hours ({DASH} if blank)</label>
          <input
            className="inp full"
            type="number"
            min={0}
            step={0.5}
            placeholder="e.g. 120"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />

          <label className="fl">Blurb — what this build is, in a line</label>
          <textarea
            className="inp full"
            rows={3}
            style={{ resize: 'vertical' }}
            placeholder="What it does and who it’s for."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <Err msg={err} />

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn mint" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
