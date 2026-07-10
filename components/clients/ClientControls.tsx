'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

const STAGES = ['prospect', 'discovery', 'proposal', 'active', 'paused', 'past'] as const;
const HEALTH = [null, 'green', 'yellow', 'red'] as const;

// Inline stage/health selectors for the client detail page.
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
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="flex items-center gap-1">
        <span className="p-label mr-1">Stage</span>
        {STAGES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => s !== stage && patch({ stage: s })}
            className={`cursor-pointer rounded-console px-2 py-0.5 font-mono text-[10px] tracking-wider transition ${
              s === stage ? 'bg-panel-2 text-mint' : 'text-ink-4 hover:text-ink-2'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </span>
      <span className="flex items-center gap-1">
        <span className="p-label mr-1">Health</span>
        {HEALTH.map((h) => (
          <button
            key={h ?? 'unset'}
            disabled={busy}
            onClick={() => h !== health && patch({ health: h })}
            className={`cursor-pointer rounded-console px-2 py-0.5 font-mono text-[10px] tracking-wider transition ${
              h === health
                ? h === 'green'
                  ? 'bg-panel-2 text-actual'
                  : h === 'yellow'
                    ? 'bg-panel-2 text-warn'
                    : h === 'red'
                      ? 'bg-panel-2 text-danger'
                      : 'bg-panel-2 text-ink-3'
                : 'text-ink-4 hover:text-ink-2'
            }`}
          >
            {h ? `● ${h.toUpperCase()}` : 'UNSET'}
          </button>
        ))}
      </span>
    </div>
  );
}

// Note logger for the client history.
export function NoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    await fetch(`/api/clients/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim() }),
    });
    setNote('');
    router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="log a note on this client…"
        disabled={busy}
        className="w-full rounded-console border border-edge bg-panel-2 px-3 py-1.5 font-mono text-[12px] text-ink outline-none placeholder:text-ink-5 focus:border-mint"
      />
    </form>
  );
}

// New-client inline form for the board page.
export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
    } else {
      setName('');
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      {error && <span className="font-mono text-[10.5px] text-danger">{error}</span>}
      <div className="flex items-center gap-1.5 rounded-console border border-edge bg-panel-2 px-2.5 py-1 focus-within:border-mint">
        <Plus size={11} className="text-mint" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="new client name…"
          disabled={busy}
          className="w-[180px] bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-ink-5"
        />
      </div>
    </form>
  );
}
