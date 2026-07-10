'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export function SummarizeButton({ repoId }: { repoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}/summarize`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.ok) setError(body.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && (
        <span className="max-w-[320px] truncate font-mono text-[10.5px] text-danger" title={error}>
          {error}
        </span>
      )}
      <button
        onClick={summarize}
        disabled={busy}
        className="flex cursor-pointer items-center gap-1.5 rounded-console border border-edge bg-panel-2 px-2.5 py-1 font-mono text-[10.5px] tracking-wider text-ink-3 transition hover:border-mint hover:text-mint disabled:opacity-50"
      >
        <Sparkles size={11} className={busy ? 'animate-pulse' : ''} />
        {busy ? 'SUMMARIZING…' : 'AI SUMMARY'}
      </button>
    </span>
  );
}
