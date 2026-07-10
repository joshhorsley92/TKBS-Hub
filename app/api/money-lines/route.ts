import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// POST /api/money-lines — add a projected revenue/cost line to a decision
// (or venture/client). The planning ledger; FreshBooks owns actuals.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const direction = body.direction;
  const cadence = body.cadence;
  const amount = Number(body.amount);
  if (!['revenue', 'cost'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be revenue|cost' }, { status: 400 });
  }
  if (!['one_time', 'monthly'].includes(cadence)) {
    return NextResponse.json({ error: 'cadence must be one_time|monthly' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 });
  }
  if (!body.decision_id && !body.venture_id && !body.client_id) {
    return NextResponse.json({ error: 'attribute to a decision, venture, or client' }, { status: 400 });
  }

  const { supabase, userId } = auth;
  const row: Record<string, unknown> = {
    direction,
    cadence,
    amount,
    confidence: body.confidence != null ? Number(body.confidence) : 1.0,
    occurs_on: cadence === 'one_time' ? (body.occurs_on ?? new Date().toISOString().slice(0, 10)) : null,
    starts_on: cadence === 'monthly' ? (body.starts_on ?? new Date().toISOString().slice(0, 10)) : null,
    ends_on: cadence === 'monthly' ? (body.ends_on ?? null) : null,
    decision_id: body.decision_id ?? null,
    venture_id: body.venture_id ?? null,
    client_id: body.client_id ?? null,
    category: body.category ?? 'general',
    memo: body.memo ?? null,
    created_by: userId,
  };
  if (direction === 'cost' && body.cost_basis) {
    row.cost_basis = body.cost_basis;
    row.hours_per_period = body.hours_per_period ?? null;
    row.hourly_rate = body.hourly_rate ?? null;
    row.assignee_id = body.assignee_id ?? null;
  }

  const { data, error } = await supabase.from('money_lines').insert(row).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
