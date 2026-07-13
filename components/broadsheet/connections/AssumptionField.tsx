'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Inline editor for a planning assumption (a number, or JSON like
// {"evaluating":0.3,"committed":0.9}).
//
// These are the only hand-entered constants the money model is allowed to use,
// so an unset one reads NOT SET in amber and stays null — the model then renders
// "—" downstream rather than quietly assuming a value.
export function AssumptionField({ assumptionKey, value }: { assumptionKey: string; value: unknown }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    let parsed: unknown = null;
    const trimmed = draft.trim();
    if (trimmed !== '') {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        setError('not valid JSON (a bare number like 30 is fine)');
        return;
      }
    }

    setBusy(true);
    setError(null);
    const res = await fetch('/api/assumptions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: assumptionKey, value: parsed }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
    }
    setBusy(false);
  }

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: value == null ? 'var(--amber)' : 'var(--ink)',
          }}
        >
          {value == null ? 'NOT SET' : JSON.stringify(value)}
        </span>
        <button className="tog" onClick={() => setEditing(true)} title={`Edit ${assumptionKey}`}>
          Edit
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        autoFocus
        className="inp"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder='30 or {"committed":0.9}'
        disabled={busy}
        style={{ width: 220, fontFamily: 'var(--mono)', fontSize: 12.5, padding: '6px 10px' }}
      />
      <button className="btn mint sm" onClick={() => void save()} disabled={busy}>
        Save
      </button>
      <button
        className="tog"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--danger)' }}>{error}</span>}
    </span>
  );
}
