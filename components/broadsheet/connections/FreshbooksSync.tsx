'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SyncError } from './SyncNowButton';

// Pulls invoices, payments and expenses from FreshBooks. Only rendered once the
// OAuth handshake has actually happened — until then there is no token to sync
// with, and the page says so instead of offering a button that would 500.
export function FreshbooksSync() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/freshbooks', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) setError(body.error ?? `HTTP ${res.status}`);
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
        {busy ? 'Syncing…' : 'Sync FreshBooks'}
      </button>
    </span>
  );
}
