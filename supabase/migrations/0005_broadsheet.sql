-- ============================================================================
-- TKBS-Hub — 0005: Broadsheet
--
-- The Broadsheet redesign introduces five concepts the schema didn't model.
-- This migration adds them as REAL tables so the UI has somewhere honest to
-- read from. It seeds NO data: every table below starts empty and the console
-- renders an empty state until a human enters something real. Nothing here
-- fabricates a number.
--
--   initiatives          the hand-kept planning ledger (NOT derived from repos)
--   initiative_decisions the append-only "calls we actually made" log
--   build_deployments    the reuse map: one internal build → N clients
--   campaigns / leads    the acquisition funnel (top of Pipeline)
--   workspace_prefs      per-person theme / nav / Pulse layout
--
-- Plus: due-dates on work_items (the 2-week look-ahead), relationship facts on
-- clients, and v_client_money (revenue · cost · potential, per client).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Initiatives — the one curated surface. Status is mostly derived from repo
-- signal; only the calls a human makes get logged.
-- ---------------------------------------------------------------------------
create table if not exists public.initiatives (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  why                    text,
  owner_id               uuid not null references public.profiles(id),
  lane                   text not null default 'Client'
                           check (lane in ('Client', 'Product', 'Service', 'Ops')),
  status                 text not null default 'idea'
                           check (status in ('idea', 'evaluating', 'active', 'paused', 'shipped')),
  health                 text check (health in ('green', 'yellow', 'red')),
  -- 0..1. Hand-set: this is a judgement call, not a computed figure.
  progress               numeric(3, 2) not null default 0
                           check (progress >= 0 and progress <= 1),
  -- Blocked on a teammate, or on someone outside the company (client/vendor).
  blocked_on_profile_id  uuid references public.profiles(id),
  blocked_on_external    boolean not null default false,
  block_note             text,
  repo_id                uuid references public.repos(id)    on delete set null,
  client_id              uuid references public.clients(id)  on delete set null,
  venture_id             uuid references public.ventures(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists initiatives_status_idx on public.initiatives (status);
create index if not exists initiatives_owner_idx  on public.initiatives (owner_id);

create table if not exists public.initiative_decisions (
  id            bigint generated always as identity primary key,
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  body          text not null,
  actor_id      uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index if not exists initiative_decisions_init_idx
  on public.initiative_decisions (initiative_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Build deployments — "build once, deploy many". A build IS a venture; this is
-- the map from that venture to the clients it serves (or could serve).
-- ---------------------------------------------------------------------------
create table if not exists public.build_deployments (
  id         uuid primary key default gen_random_uuid(),
  venture_id uuid not null references public.ventures(id) on delete cascade,
  client_id  uuid not null references public.clients(id)  on delete cascade,
  status     text not null default 'deployed'
               check (status in ('deployed', 'candidate')),
  role       text,   -- e.g. 'fixture' — the client that proved it out
  since      date,
  created_at timestamptz not null default now(),
  unique (venture_id, client_id)
);

-- Builds carry a one-line pitch and an engineering-investment figure.
-- eng_hours is NULLABLE ON PURPOSE: there is no trustworthy source for it yet
-- (FreshBooks time entries would be one). Null renders as "—", never as 0.
alter table public.ventures add column if not exists blurb     text;
alter table public.ventures add column if not exists eng_hours numeric(7, 1);

comment on column public.ventures.eng_hours is
  'Engineering hours invested. Hand-entered — no automatic source yet. NULL = unknown, renders as "—".';

-- ---------------------------------------------------------------------------
-- Acquisition — campaigns feed leads; leads convert into clients.
-- Every figure here is entered by a human or (later) synced from an ad
-- platform. Nothing is inferred.
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  platform    text not null check (platform in ('meta', 'google', 'organic')),
  status      text not null default 'active'
                check (status in ('active', 'paused', 'ended')),
  spend       numeric(12, 2),
  impressions bigint,
  clicks      bigint,
  start_on    date,
  end_on      date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  -- Fit-Score (0-100) from the CRM model. Null until scored.
  fit         smallint check (fit >= 0 and fit <= 100),
  stage       text not null default 'new'
                check (stage in ('new', 'qualified', 'proposal', 'won', 'lost')),
  est_value   numeric(12, 2),
  recurring   boolean not null default false,
  industry    text,
  contact     text,
  note        text,
  -- Set when the lead is converted into a client record.
  client_id   uuid references public.clients(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists leads_stage_idx on public.leads (stage);

-- ---------------------------------------------------------------------------
-- 2-week look-ahead — work_items gain a due date and a source, so the rolling
-- today→+14d window can be derived. Existing rows keep due_on = null and simply
-- don't appear in the look-ahead.
-- ---------------------------------------------------------------------------
alter table public.work_items add column if not exists due_on     date;
alter table public.work_items add column if not exists source     text not null default 'hub';
alter table public.work_items add column if not exists venture_id uuid references public.ventures(id) on delete set null;

do $$ begin
  alter table public.work_items add constraint work_items_source_check
    check (source in ('git', 'freshbooks', 'cal', 'crm', 'hub'));
exception when duplicate_object then null; end $$;

create index if not exists work_items_due_idx on public.work_items (due_on) where due_on is not null;

-- ---------------------------------------------------------------------------
-- Clients — relationship facts (not money; money stays in money_lines / fb_*).
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists engagement text;
alter table public.clients add column if not exists since      date;

comment on column public.clients.engagement is
  'What we are doing for them, in words (e.g. "Launch → Boost"). Not a price.';

-- ---------------------------------------------------------------------------
-- Per-person workspaces — theme, sidebar order, landing page, Pulse layout.
-- Shape is owned by the app (see lib/workspace.ts); stored opaque.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- v_client_money — revenue · cost · potential, per client.
--
-- Honours the anti-double-count rule and the never-fabricate rule:
--   revenue_actual    FreshBooks payments received. NULL until FB is connected.
--   cost_actual       FreshBooks expenses booked to the client. NULL if none.
--   potential_monthly Open, recurring, projected revenue lines — the go-forward
--                     run-rate. NULL if nothing is on the books.
-- sum() over zero rows is NULL, and that is deliberate: NULL means "we don't
-- know", which the UI renders as "—". It never means zero.
-- ---------------------------------------------------------------------------
create or replace view public.v_client_money with (security_invoker = true) as
select
  c.id as client_id,
  (
    select sum(i.paid)
    from public.fb_invoices i
    where c.fb_client_id is not null
      and i.fb_client_id = c.fb_client_id
      and i.status not in ('draft', 'declined', 'void', 'deleted')
  ) as revenue_actual,
  (
    select sum(e.amount)
    from public.fb_expenses e
    where c.fb_client_id is not null
      and e.fb_client_id = c.fb_client_id
  ) as cost_actual,
  (
    select sum(m.amount)
    from public.money_lines m
    where m.client_id = c.id
      and m.direction = 'revenue'
      and m.cadence   = 'monthly'
      and m.status    = 'open'
      and (m.ends_on is null or m.ends_on >= current_date)
  ) as potential_monthly,
  (
    select sum(m.amount)
    from public.money_lines m
    where m.client_id = c.id
      and m.direction = 'revenue'
      and m.cadence   = 'one_time'
      and m.status    = 'open'
  ) as pipeline_one_time
from public.clients c;

-- ---------------------------------------------------------------------------
-- RLS — same posture as 0003: any hub user (a row in profiles) gets full CRUD.
-- ---------------------------------------------------------------------------
alter table public.initiatives          enable row level security;
alter table public.initiative_decisions enable row level security;
alter table public.build_deployments    enable row level security;
alter table public.campaigns            enable row level security;
alter table public.leads                enable row level security;
alter table public.workspace_prefs      enable row level security;

-- Both founders share full data access, and the console supports customising a
-- workspace on someone's behalf, so prefs are readable and writable by any hub
-- user rather than owner-only.
do $$
declare t text;
begin
  foreach t in array array[
    'initiatives', 'initiative_decisions', 'build_deployments',
    'campaigns', 'leads', 'workspace_prefs'
  ] loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format(
      'create policy members_all on public.%I for all to authenticated '
      'using (public.is_hub_user()) with check (public.is_hub_user())', t);
  end loop;
end $$;
