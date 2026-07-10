'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';

// Inline editor for a planning assumption. Accepts a number or JSON
// (e.g. 30, or {"evaluating":0.3,"committed":0.9}). Empty = unset (null).
export function AssumptionEditor({ assumptionKey, value }: { assumptionKey: string; value: unknown }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === null ? '' : JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    let parsed: unknown = null;
    const trimmed = draft.trim();
    if (trimmed !== '') {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        setError('not valid JSON (numbers like 30 are fine)');
        return;
      }
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/assumptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: assumptionKey, value: parsed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
    } else {
      setEditing(false);
      router.refresh();
    }
    setBusy(false);
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span className={value === null ? 'text-warn' : 'text-ink'}>
          {value === null ? 'NOT SET' : JSON.stringify(value)}
        </span>
        <button
          onClick={() => setEditing(true)}
          title={`edit ${assumptionKey}`}
          className="cursor-pointer text-ink-5 transition hover:text-mint"
        >
          <Pencil size={11} />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder='e.g. 30 or {"committed":0.9}'
        disabled={busy}
        className="w-[220px] rounded-console border border-edge bg-panel-2 px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-mint"
      />
      <button onClick={save} disabled={busy} className="cursor-pointer text-actual hover:text-mint"><Check size={13} /></button>
      <button onClick={() => { setEditing(false); setError(null); }} className="cursor-pointer text-ink-4 hover:text-danger"><X size={13} /></button>
      {error && <span className="font-mono text-[10px] text-danger">{error}</span>}
    </span>
  );
}
