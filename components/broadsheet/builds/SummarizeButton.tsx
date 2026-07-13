'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Distils a repo's ingested commit history into a prose "what's being worked on"
// summary. On demand only — it spends tokens, so it never runs on page load.
export function SummarizeButton({ repoId, hasSummary }: { repoId: string; hasSummary: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}/summarize`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) setError(body?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {error && (
        <span
          className="sample"
          style={{ color: 'var(--danger)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={error}
        >
          {error}
        </span>
      )}
      <button className="btn ghost sm" onClick={() => void summarize()} disabled={busy}>
        {busy ? 'Summarizing…' : hasSummary ? 'Regenerate summary' : 'Summarize commits'}
      </button>
    </span>
  );
}
