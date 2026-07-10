-- ============================================================================
-- TKBS-Hub — 0003: derived views (the money substrate) + RLS
--
-- Money semantics (THE anti-double-count rule, mirrored in lib/money.ts):
--   * Actual revenue  = FreshBooks invoices (non-draft/void). Never hand-entered.
--   * Actual cost     = FreshBooks expenses ∪ hand-entered actual-cost planning
--                       lines only until FB expenses cover them.
--   * Potential       = OPEN projected money_lines, weighted by confidence.
--   * Realization     = money_lines.realized_by_fb_invoice_id set → line status
--                       flips 'realized' → leaves "potential"; the FB actual
--                       takes over. Nothing is ever counted twice.
--   * FB estimates    = a pipeline signal lane; NEVER summed into actuals.
-- All views are security_invoker — they run under the caller's RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_money — unified line substrate: open planning lines ∪ FreshBooks actuals
-- ---------------------------------------------------------------------------
create view public.v_money with (security_invoker = true) as
-- Planning layer: open projected lines
select
  'plan:' || ml.id                       as line_key,
  'plan'                                 as source,
  ml.direction,
  'projected'                            as certainty,
  ml.confidence,
  ml.cadence,
  ml.amount,
  ml.occurs_on,
  ml.starts_on,
  ml.ends_on,
  ml.decision_id,
  ml.venture_id,
  ml.client_id,
  ml.category,
  ml.hours_per_period,
  ml.assignee_id
from public.money_lines ml
where ml.status = 'open'

union all

-- Actuals: FreshBooks invoices → revenue (attributed to a decision when a
-- projection was realized by this invoice, to a client via fb_client_id map)
select
  'fb:inv:' || i.fb_id,
  'freshbooks',
  'revenue',
  'actual',
  1.00,
  'one_time',
  i.amount,
  i.create_date,
  null, null,
  rl.decision_id,
  rl.venture_id,
  c.id,
  'client_deal',
  null, null
from public.fb_invoices i
left join public.clients c on c.fb_client_id = i.fb_client_id
left join lateral (
  select ml.decision_id, ml.venture_id
  from public.money_lines ml
  where ml.realized_by_fb_invoice_id = i.fb_id
  limit 1
) rl on true
where coalesce(i.status, '') not in ('draft', 'declined', 'void', 'deleted')

union all

-- Actuals: FreshBooks expenses → cost
select
  'fb:exp:' || e.fb_id,
  'freshbooks',
  'cost',
  'actual',
  1.00,
  'one_time',
  e.amount,
  e.date,
  null, null,
  null, null,
  c.id,
  coalesce(e.category, 'expense'),
  null, null
from public.fb_expenses e
left join public.clients c on c.fb_client_id = e.fb_client_id;

-- ---------------------------------------------------------------------------
-- v_money_monthly — month-grain expansion (the reporting workhorse).
-- Monthly lines expand across their window (open-ended lines capped at
-- +24 months); one-time lines land in their month. weighted_amount applies
-- confidence to projections only.
-- ---------------------------------------------------------------------------
create view public.v_money_monthly with (security_invoker = true) as
select
  m.month::date as month,
  v.*,
  round(v.amount * case when v.certainty = 'projected' then v.confidence else 1 end, 2)
    as weighted_amount
from public.v_money v
cross join lateral generate_series(
  date_trunc('month', coalesce(v.starts_on, v.occurs_on)),
  least(
    date_trunc('month', coalesce(v.ends_on, v.occurs_on, (current_date + interval '24 months')::date)),
    date_trunc('month', current_date + interval '24 months')
  ),
  interval '1 month'
) as m(month)
where coalesce(v.starts_on, v.occurs_on) is not null;

-- ---------------------------------------------------------------------------
-- v_decision_pnl — per-decision P&L, projected vs actual-to-date
-- ---------------------------------------------------------------------------
create view public.v_decision_pnl with (security_invoker = true) as
select
  d.id,
  d.title,
  d.status,
  d.kind,
  sum(v.weighted_amount) filter (where v.direction = 'revenue' and v.certainty = 'projected') as projected_revenue,
  sum(v.weighted_amount) filter (where v.direction = 'cost'    and v.certainty = 'projected') as projected_cost,
  sum(v.weighted_amount) filter (where v.direction = 'revenue' and v.certainty = 'actual'
                                   and v.month <= date_trunc('month', current_date))          as actual_revenue_to_date,
  sum(v.weighted_amount) filter (where v.direction = 'cost'    and v.certainty = 'actual'
                                   and v.month <= date_trunc('month', current_date))          as actual_cost_to_date
from public.decisions d
left join public.v_money_monthly v on v.decision_id = d.id
group by d.id, d.title, d.status, d.kind;

-- ---------------------------------------------------------------------------
-- v_company_pnl_monthly — company P&L per month, real vs potential ALWAYS
-- separated (never blended into one number)
-- ---------------------------------------------------------------------------
create view public.v_company_pnl_monthly with (security_invoker = true) as
select
  month,
  certainty,
  coalesce(sum(weighted_amount) filter (where direction = 'revenue'), 0) as revenue,
  coalesce(sum(weighted_amount) filter (where direction = 'cost'), 0)    as cost,
  coalesce(sum(weighted_amount) filter (where direction = 'revenue'), 0)
    - coalesce(sum(weighted_amount) filter (where direction = 'cost'), 0) as net
from public.v_money_monthly
group by month, certainty;

-- ---------------------------------------------------------------------------
-- v_capacity_monthly — hours per person per month: projected (time-cost lines
-- on committed/active decisions) vs actual (FreshBooks time entries).
-- The future hiring module plugs in here without redesign.
-- ---------------------------------------------------------------------------
create view public.v_capacity_monthly with (security_invoker = true) as
select
  v.month,
  v.assignee_id as profile_id,
  'projected'   as kind,
  sum(v.hours_per_period) as hours
from public.v_money_monthly v
join public.decisions d on d.id = v.decision_id and d.status in ('committed', 'active')
where v.hours_per_period is not null
group by v.month, v.assignee_id

union all

select
  date_trunc('month', t.started_at)::date,
  t.profile_id,
  'actual',
  round(sum(t.duration_seconds) / 3600.0, 1)
from public.fb_time_entries t
where t.started_at is not null
group by 1, 2;

-- ============================================================================
-- RLS — two trusted users. Any authenticated user with a profile gets access;
-- write surfaces differ by table. Automated ingestion uses the service role
-- (bypasses RLS). integration_tokens gets NO authenticated policies at all.
-- ============================================================================
create or replace function public.is_hub_user()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid()) $$;

-- Full read/write for hub members ------------------------------------------
alter table public.clients        enable row level security;
alter table public.client_events  enable row level security;
alter table public.ventures       enable row level security;
alter table public.decisions      enable row level security;
alter table public.decision_events enable row level security;
alter table public.money_lines    enable row level security;
alter table public.assumptions    enable row level security;
alter table public.work_items     enable row level security;
alter table public.repos          enable row level security;
alter table public.identities     enable row level security;

create policy members_all on public.clients         for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.client_events   for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.ventures        for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.decisions       for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.decision_events for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.money_lines     for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.assumptions     for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.work_items      for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.repos           for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());
create policy members_all on public.identities      for all to authenticated using (public.is_hub_user()) with check (public.is_hub_user());

-- Profiles: read all, update own -------------------------------------------
alter table public.profiles enable row level security;
create policy profiles_read   on public.profiles for select to authenticated using (public.is_hub_user());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- work_log: append-only for members (manual notes); git/FB rows come in via
-- service role. No update/delete from the app.
alter table public.work_log enable row level security;
create policy work_log_read   on public.work_log for select to authenticated using (public.is_hub_user());
create policy work_log_insert on public.work_log for insert to authenticated with check (public.is_hub_user() and source = 'manual');

-- Synced mirrors: read-only for members; only the service role writes -------
alter table public.fb_clients      enable row level security;
alter table public.fb_invoices     enable row level security;
alter table public.fb_payments     enable row level security;
alter table public.fb_expenses     enable row level security;
alter table public.fb_time_entries enable row level security;
alter table public.fb_estimates    enable row level security;
alter table public.ingest_runs     enable row level security;

create policy members_read on public.fb_clients      for select to authenticated using (public.is_hub_user());
create policy members_read on public.fb_invoices     for select to authenticated using (public.is_hub_user());
create policy members_read on public.fb_payments     for select to authenticated using (public.is_hub_user());
create policy members_read on public.fb_expenses     for select to authenticated using (public.is_hub_user());
create policy members_read on public.fb_time_entries for select to authenticated using (public.is_hub_user());
create policy members_read on public.fb_estimates    for select to authenticated using (public.is_hub_user());
create policy members_read on public.ingest_runs     for select to authenticated using (public.is_hub_user());

-- integration_tokens: RLS on, ZERO authenticated policies → deny-all for the
-- app; only the service role (RLS-bypassing) touches OAuth tokens.
alter table public.integration_tokens enable row level security;
