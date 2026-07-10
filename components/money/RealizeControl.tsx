'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type InvoiceOption = { fb_id: number; label: string };

// Per-line "this projection became real" control: pick the FreshBooks invoice
// that realized it → the line flips to realized and leaves "potential".
export function RealizeControl({
  lineId,
  invoices,
}: {
  lineId: string;
  invoices: InvoiceOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function realize(fbInvoiceId: string) {
    if (!fbInvoiceId) return;
    setBusy(true);
    await fetch(`/api/money-lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realized_by_fb_invoice_id: Number(fbInvoiceId) }),
    });
    router.refresh();
    setBusy(false);
  }

  if (invoices.length === 0) return null;

  return (
    <select
      defaultValue=""
      disabled={busy}
      onChange={(e) => realize(e.target.value)}
      title="realize against a FreshBooks invoice"
      className="rounded-console border border-edge bg-panel-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-4 outline-none focus:border-mint"
    >
      <option value="">realize…</option>
      {invoices.map((i) => (
        <option key={i.fb_id} value={i.fb_id}>
          {i.label}
        </option>
      ))}
    </select>
  );
}
