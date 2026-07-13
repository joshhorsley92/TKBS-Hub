'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Lead } from '@/lib/board';
import { DASH, money } from '@/lib/broadsheet';
import { useModal } from '../useModal';

// The write side of the Pipeline.
//
// Every number on these forms is optional except a name. That is the point: a
// human can add a lead knowing only who they are, and the board will render the
// fit score and the estimate as "—" rather than pretending they were scored at
// zero. Blank stays blank all the way down — the API turns '' into null.

type CampaignOption = { id: string; name: string };

const STAGES = ['new', 'qualified', 'proposal', 'won', 'lost'] as const;
const PLATFORMS: [string, string][] = [
  ['meta', 'Meta'],
  ['google', 'Google'],
  ['organic', 'Organic'],
];
const STATUSES = ['active', 'paused', 'ended'];

/* ── shell ───────────────────────────────────────────────────────────────── */

function Modal({
  eyebrow,
  title,
  sub,
  onClose,
  error,
  children,
  foot,
  width,
}: {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  error: string | null;
  children: ReactNode;
  foot: ReactNode;
  width?: number;
}) {
  useModal(true, onClose);
  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={width ? { width: `min(${width}px, 94vw)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow">{eyebrow}</div>
        <h3 style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, margin: '6px 0 3px' }}>
          {title}
        </h3>
        {sub && <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 14 }}>{sub}</p>}

        {children}

        {error && (
          <div className="smol" style={{ color: 'var(--danger)', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 22 }}>
          {foot}
        </div>
      </div>
    </div>
  );
}

/** Uniform tog group — the design system's only radio control. */
function Togs({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`tog${value === key ? ' on' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── add lead ────────────────────────────────────────────────────────────── */

export function AddLeadButton({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contact, setContact] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [fit, setFit] = useState('');
  const [estValue, setEstValue] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || null,
          contact: contact.trim() || null,
          campaign_id: campaignId || null,
          // Blank means "nobody has scored / estimated this". The API stores
          // null, and the board draws a dash. Never a zero.
          fit: fit.trim() || null,
          est_value: estValue.trim() || null,
          recurring,
          note: note.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? 'Could not save the lead.');
        return;
      }
      setName('');
      setIndustry('');
      setContact('');
      setCampaignId('');
      setFit('');
      setEstValue('');
      setRecurring(false);
      setNote('');
      close();
      router.refresh();
    } catch {
      setError('Could not reach the hub. The lead was not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn mint" onClick={() => setOpen(true)}>
        Add lead
      </button>

      {open && (
        <Modal
          eyebrow="New lead"
          title="Add a lead"
          sub="Only the name is required. Leave the fit score or the estimate blank and they stay honestly unknown."
          onClose={close}
          error={error}
          foot={
            <>
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Lands at the New stage.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={close}>
                  Cancel
                </button>
                <button className="btn mint" onClick={() => void submit()} disabled={busy || !name.trim()}>
                  {busy ? 'Saving…' : 'Add lead'}
                </button>
              </div>
            </>
          }
        >
          <label className="fl">Name · required</label>
          <input
            className="inp full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business or person"
            autoFocus
          />

          <label className="fl">Industry</label>
          <input
            className="inp full"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. HVAC, dental, landscaping"
          />

          <label className="fl">Contact</label>
          <input
            className="inp full"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Name, email or phone"
          />

          <label className="fl">Campaign</label>
          <select className="inp full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">
              {campaigns.length ? 'None — hand-added' : 'No campaigns recorded yet'}
            </option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="fl">Fit score · 0–100</label>
              <input
                className="inp full"
                type="number"
                min={0}
                max={100}
                value={fit}
                onChange={(e) => setFit(e.target.value)}
                placeholder="blank = not scored"
              />
            </div>
            <div>
              <label className="fl">Est. value</label>
              <input
                className="inp full"
                type="number"
                min={0}
                value={estValue}
                onChange={(e) => setEstValue(e.target.value)}
                placeholder="blank = unknown"
              />
            </div>
          </div>

          <label className="fl">Recurring</label>
          <button type="button" className={`tog${recurring ? ' on' : ''}`} onClick={() => setRecurring((r) => !r)}>
            {recurring ? 'Recurring · /mo' : 'One-time'}
          </button>

          <label className="fl">Note</label>
          <textarea
            className="inp full"
            style={{ minHeight: 60, resize: 'vertical', fontFamily: 'var(--body)' }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What do they need? Where did they come from?"
          />
        </Modal>
      )}
    </>
  );
}

/* ── add campaign ────────────────────────────────────────────────────────── */

export function AddCampaignButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('meta');
  const [status, setStatus] = useState('active');
  const [spend, setSpend] = useState('');
  const [impressions, setImpressions] = useState('');
  const [clicks, setClicks] = useState('');
  const [note, setNote] = useState('');

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          platform,
          status,
          // All three figures are hand-entered until Meta/Google are wired.
          // Blank stays null so the card shows "—" instead of a fictional zero.
          spend: spend.trim() || null,
          impressions: impressions.trim() || null,
          clicks: clicks.trim() || null,
          note: note.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? 'Could not save the campaign.');
        return;
      }
      setName('');
      setSpend('');
      setImpressions('');
      setClicks('');
      setNote('');
      close();
      router.refresh();
    } catch {
      setError('Could not reach the hub. The campaign was not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Add campaign
      </button>

      {open && (
        <Modal
          eyebrow="New campaign"
          title="Add a campaign"
          sub="No ad platform is connected, so spend, reach and clicks are whatever you type here. Leave any of them blank and the board reads them as unknown."
          onClose={close}
          error={error}
          foot={
            <>
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Figures are all optional.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={close}>
                  Cancel
                </button>
                <button className="btn mint" onClick={() => void submit()} disabled={busy || !name.trim()}>
                  {busy ? 'Saving…' : 'Add campaign'}
                </button>
              </div>
            </>
          }
        >
          <label className="fl">Name · required</label>
          <input
            className="inp full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spring HVAC retarget"
            autoFocus
          />

          <label className="fl">Platform</label>
          <Togs options={PLATFORMS} value={platform} onChange={setPlatform} />

          <label className="fl">Status</label>
          <Togs options={STATUSES.map((s) => [s, s] as [string, string])} value={status} onChange={setStatus} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="fl">Spend</label>
              <input
                className="inp full"
                type="number"
                min={0}
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <label className="fl">Impressions</label>
              <input
                className="inp full"
                type="number"
                min={0}
                value={impressions}
                onChange={(e) => setImpressions(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <label className="fl">Clicks</label>
              <input
                className="inp full"
                type="number"
                min={0}
                value={clicks}
                onChange={(e) => setClicks(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <label className="fl">Note</label>
          <textarea
            className="inp full"
            style={{ minHeight: 60, resize: 'vertical', fontFamily: 'var(--body)' }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is this campaign doing?"
          />
        </Modal>
      )}
    </>
  );
}

/* ── stage advance ───────────────────────────────────────────────────────── */

/**
 * Move a lead through the funnel from its row. Winning it is not a cosmetic
 * stage change: the API converts the lead into a real client record and links
 * the two, which is why the row then shows an "in hub" chip.
 */
export function StageAdvance({ leadId, stage }: { leadId: string; stage: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function move(next: string) {
    if (next === stage || busy) return;
    setBusy(next);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} title="Move this lead through the funnel">
      {STAGES.map((s) => (
        <button
          key={s}
          className={`tog${s === stage ? ' on' : ''}`}
          style={{ padding: '4px 8px' }}
          disabled={busy !== null}
          onClick={() => void move(s)}
        >
          {busy === s ? '…' : s.slice(0, 4)}
        </button>
      ))}
    </div>
  );
}

/* ── proposal ────────────────────────────────────────────────────────────── */

/**
 * Every TKBS proposal is bespoke — there are no engagement tiers, and this modal
 * deliberately doesn't offer any. It captures a custom price and the scope in
 * the operator's own words, then converts the lead into a client.
 *
 * There is no "draft with Claude" button: ANTHROPIC_API_KEY isn't set in this
 * environment, and a button that always errors is worse than no button.
 */
export function ProposalButton({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [price, setPrice] = useState(
    lead.estValue !== null ? `${money(lead.estValue)}${lead.recurring ? '/mo' : ''}` : '',
  );
  const [scope, setScope] = useState(lead.note ?? '');

  function close() {
    setOpen(false);
    setError(null);
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // The scope note and the agreed price are the only things there is
      // anywhere to put — the hub has no proposal-document store — so they go
      // onto the lead's note. No money is written here: the deal's value becomes
      // a money_line when someone actually books it.
      const body: { stage: string; note?: string } = { stage: 'won' };
      const written = [scope.trim(), price.trim() ? `Proposed: ${price.trim()}` : '']
        .filter(Boolean)
        .join('\n\n');
      if (written) body.note = written;

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => null)) as { clientId?: string; error?: string } | null;

      if (!res.ok) {
        setError(out?.error ?? 'Could not create the client.');
        return;
      }
      if (out?.clientId) {
        router.push(`/clients/${out.clientId}`);
        return;
      }
      // Saved, but the API returned no client id — refresh rather than navigate
      // somewhere that may not exist.
      close();
      router.refresh();
    } catch {
      setError('Could not reach the hub. Nothing was created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn mint sm" onClick={() => setOpen(true)}>
        Generate proposal
      </button>

      {open && (
        <Modal
          eyebrow="Custom proposal"
          title={lead.name}
          sub={
            <>
              {lead.industry ?? DASH} · Fit {lead.fit === null ? `${DASH}/100 (not scored)` : `${lead.fit}/100`} ·
              est. {money(lead.estValue)}
              {lead.estValue !== null && lead.recurring ? '/mo' : ''}
            </>
          }
          onClose={close}
          error={error}
          width={600}
          foot={
            <>
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                Creates {lead.name} as a client in the hub. No money is booked.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={close}>
                  Cancel
                </button>
                <button className="btn mint" onClick={() => void create()} disabled={busy}>
                  {busy ? 'Creating…' : 'Create in hub →'}
                </button>
              </div>
            </>
          }
        >
          {/* No tiers, on purpose: TKBS prices every engagement from scratch. */}
          <label className="fl">Proposed price · custom</label>
          <input
            className="inp full"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. $4,500 one-time or $900/mo"
          />

          <label className="fl">Scope notes</label>
          <textarea
            className="inp full"
            style={{ minHeight: 90, resize: 'vertical', fontFamily: 'var(--body)' }}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="What are they trying to do, and what are you proposing to build?"
          />

          <p className="smol" style={{ marginTop: 8 }}>
            What you write here is what gets saved — it lands on the lead’s note and travels with them
            into the client record. Nothing is drafted or invented for you.
          </p>
        </Modal>
      )}
    </>
  );
}
