'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Manual GitHub poll. Same endpoint the scheduled sync hits — this is only the
// "don't wait for the next tick" path. A failure is shown verbatim rather than
// swallowed: a sync that didn't run must never look like a board with no news.
export function SyncNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/github', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.error ?? body.stats?.errors?.join('; ') ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {error && <SyncError message={error} />}
      <button className="btn ghost sm" onClick={() => void sync()} disabled={busy}>
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </span>
  );
}

export function SyncError({ message }: { message: string }) {
  return (
    <span
      className="sample"
      title={message}
      style={{
        color: 'var(--danger)',
        maxWidth: 320,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </span>
  );
}
