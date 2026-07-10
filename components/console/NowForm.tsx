'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

// The now-strip logger: one line, hit enter, the cockpit updates.
export function NowForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
      } else {
        setTitle('');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <span className="p-label shrink-0">Now working on</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-console border border-edge bg-panel-2 px-3 py-1.5 focus-within:border-mint">
        <ChevronRight size={13} className="shrink-0 text-mint" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="what are you on? (enter to log)"
          disabled={busy}
          className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-5"
        />
      </div>
      {error && <span className="shrink-0 font-mono text-[10.5px] text-danger">{error}</span>}
    </form>
  );
}
