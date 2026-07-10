'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type FbClientOption = { fb_id: number; label: string };

// Maps a Hub client to its FreshBooks client so synced invoices/expenses/time
// attribute to the right account.
export function FbMappingSelect({
  clientId,
  current,
  options,
}: {
  clientId: string;
  current: number | null;
  options: FbClientOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function map(value: string) {
    setBusy(true);
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fb_client_id: value ? Number(value) : null }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <label className="flex items-center gap-2 font-mono text-[10.5px] text-ink-4">
      <span className="p-label">FreshBooks</span>
      <select
        value={current ?? ''}
        disabled={busy}
        onChange={(e) => map(e.target.value)}
        className="rounded-console border border-edge bg-panel-2 px-2 py-1 text-[11px] text-ink outline-none focus:border-mint"
      >
        <option value="">not mapped</option>
        {options.map((o) => (
          <option key={o.fb_id} value={o.fb_id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
