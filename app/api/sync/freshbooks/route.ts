import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { amt, fbListAll, getFreshbooksAuth } from '@/lib/freshbooks';

export const maxDuration = 120;

// POST /api/sync/freshbooks — mirrors invoices, payments, expenses, time
// entries, estimates, and clients. Upserts ON CONFLICT (fb_id) DO UPDATE
// (FreshBooks records mutate: payments land, invoices void). Meaningful
// events (invoice paid) land in work_log idempotently.
export async function POST(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { data: run } = await supabase
    .from('ingest_runs')
    .insert({ job: 'freshbooks_sync', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();

  const stats: Record<string, number> = {};
  try {
    const { accessToken, accountId, businessId } = await getFreshbooksAuth();
    const acct = `/accounting/account/${accountId}`;

    // ── Clients (for the mapping UI) ────────────────────────────────────
    const clients = await fbListAll(accessToken, `${acct}/users/clients`, 'clients');
    stats.clients = clients.length;
    if (clients.length) {
      await supabase.from('fb_clients').upsert(
        clients.map((c) => ({
          fb_id: Number(c.id),
          organization: (c.organization as string) || null,
          email: (c.email as string) || null,
          raw: c,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
    }

    // ── Invoices ────────────────────────────────────────────────────────
    const invoices = await fbListAll(accessToken, `${acct}/invoices/invoices`, 'invoices');
    stats.invoices = invoices.length;
    if (invoices.length) {
      await supabase.from('fb_invoices').upsert(
        invoices.map((i) => ({
          fb_id: Number(i.id),
          fb_client_id: i.customerid != null ? Number(i.customerid) : null,
          number: (i.invoice_number as string) ?? null,
          status: (i.v3_status as string) ?? String(i.status ?? ''),
          amount: amt(i.amount),
          paid: amt(i.paid),
          outstanding: amt(i.outstanding),
          currency: ((i.amount as { code?: string })?.code ?? 'USD').slice(0, 3),
          create_date: (i.create_date as string) || null,
          date_paid: (i.date_paid as string) || null,
          raw: i,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
      // Feed events for paid invoices — idempotent on external_id.
      const paid = invoices.filter((i) => (i.v3_status ?? '') === 'paid' || amt(i.outstanding) === 0 && (amt(i.paid) ?? 0) > 0);
      if (paid.length) {
        await supabase.from('work_log').upsert(
          paid.map((i) => ({
            source: 'freshbooks' as const,
            external_id: `fb:invoice:${i.id}:paid`,
            kind: 'invoice_paid',
            occurred_at: (i.date_paid as string) || (i.create_date as string) || new Date().toISOString(),
            title: `invoice ${i.invoice_number ?? i.id} paid — $${amt(i.paid) ?? amt(i.amount) ?? '?'}`,
            payload: { fb_invoice_id: i.id },
          })),
          { onConflict: 'source,external_id', ignoreDuplicates: true },
        );
      }
    }

    // ── Payments ────────────────────────────────────────────────────────
    const payments = await fbListAll(accessToken, `${acct}/payments/payments`, 'payments');
    stats.payments = payments.length;
    if (payments.length) {
      await supabase.from('fb_payments').upsert(
        payments.map((p) => ({
          fb_id: Number(p.id),
          fb_invoice_id: p.invoiceid != null ? Number(p.invoiceid) : null,
          amount: amt(p.amount),
          date: (p.date as string) || null,
          type: (p.type as string) ?? null,
          raw: p,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
    }

    // ── Expenses ────────────────────────────────────────────────────────
    const expenses = await fbListAll(accessToken, `${acct}/expenses/expenses`, 'expenses');
    stats.expenses = expenses.length;
    if (expenses.length) {
      await supabase.from('fb_expenses').upsert(
        expenses.map((e) => ({
          fb_id: Number(e.id),
          amount: amt(e.amount),
          category: (e.category_name as string) ?? (e.categoryid != null ? String(e.categoryid) : null),
          vendor: (e.vendor as string) ?? null,
          date: (e.date as string) || null,
          fb_client_id: e.clientid && Number(e.clientid) !== 0 ? Number(e.clientid) : null,
          raw: e,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
    }

    // ── Time entries ────────────────────────────────────────────────────
    const timeEntries = await fbListAll(
      accessToken,
      `/timetracking/business/${businessId}/time_entries`,
      'time_entries',
    );
    stats.time_entries = timeEntries.length;
    if (timeEntries.length) {
      // fb identity → profile mapping (kind='fb_identity', value = identity_id)
      const { data: identities } = await supabase
        .from('identities')
        .select('profile_id, kind, value')
        .eq('kind', 'fb_identity');
      const byFbId = new Map((identities ?? []).map((i) => [i.value, i.profile_id]));

      await supabase.from('fb_time_entries').upsert(
        timeEntries.map((t) => ({
          fb_id: Number(t.id),
          profile_id: byFbId.get(String(t.identity_id)) ?? null,
          fb_client_id: t.client_id != null ? Number(t.client_id) : null,
          duration_seconds: t.duration != null ? Number(t.duration) : null,
          note: (t.note as string) ?? null,
          started_at: (t.started_at as string) || null,
          billable: (t.billable as boolean) ?? null,
          raw: t,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
    }

    // ── Estimates ───────────────────────────────────────────────────────
    const estimates = await fbListAll(accessToken, `${acct}/estimates/estimates`, 'estimates');
    stats.estimates = estimates.length;
    if (estimates.length) {
      await supabase.from('fb_estimates').upsert(
        estimates.map((e) => ({
          fb_id: Number(e.id),
          fb_client_id: e.customerid != null ? Number(e.customerid) : null,
          status: String(e.status ?? ''),
          amount: amt(e.amount),
          create_date: (e.create_date as string) || null,
          raw: e,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'fb_id' },
      );
    }

    await supabase
      .from('ingest_runs')
      .update({ status: 'succeeded', finished_at: new Date().toISOString(), stats })
      .eq('id', run?.id ?? '');
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('ingest_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), stats, error: msg })
      .eq('id', run?.id ?? '');
    return NextResponse.json({ ok: false, error: msg, stats }, { status: 500 });
  }
}
