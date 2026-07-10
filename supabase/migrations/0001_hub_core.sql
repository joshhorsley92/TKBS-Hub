-- ============================================================================
-- TKBS-Hub — 0001: core schema
-- Fresh Supabase project owned entirely by the Hub (public schema).
-- Three data planes:
--   1. Hub-owned planning data  (clients, ventures, decisions, money_lines, …)
--   2. Synced mirrors           (repos/work_log from GitHub, fb_* from FreshBooks)
--   3. Derived views            (0003 — the money substrate)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'engineer' check (role in ('owner', 'engineer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'engineer')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maps external author identities (git email, GitHub login, FreshBooks
-- identity) to a person. Both people commit under the shared joshhorsley92
-- GitHub account, so git author EMAIL is the reliable discriminator.
create table public.identities (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('git_email', 'github_login', 'fb_identity')),
  value       text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients (Hub-owned — the CRM is legacy and is NOT a dependency)
-- ---------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  stage         text not null default 'prospect'
                check (stage in ('prospect', 'discovery', 'proposal', 'active', 'paused', 'past')),
  health        text check (health in ('green', 'yellow', 'red')),
  industry      text,
  website       text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  fb_client_id  bigint,           -- maps to FreshBooks client for actuals attribution
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- Append-only client history (stage changes, notes) — feeds the awareness loop.
create table public.client_events (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null default 'note' check (kind in ('note', 'stage_change', 'health_change')),
  body        text not null,
  actor_id    uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index on public.client_events (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ventures — product/service-line anchor (not a client, not a deal)
-- ---------------------------------------------------------------------------
create table public.ventures (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  kind        text not null check (kind in ('product', 'service_line', 'agency_offer', 'internal')),
  status      text not null default 'exploring'
              check (status in ('exploring', 'building', 'launched', 'sunset')),
  price_sheet jsonb,              -- [{tier,label,price,pricing_type,unit_cost?}] planning INPUT
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger ventures_updated_at before update on public.ventures
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Decisions — the novel core. A business decision/initiative that carries
-- projected and (via realization links) actual financials over its life.
-- Lifecycle: idea → evaluating → committed → active → done | killed.
-- ---------------------------------------------------------------------------
create table public.decisions (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  summary            text,
  kind               text not null check (kind in
                     ('client_deal', 'product', 'service_line', 'internal_tooling', 'hire', 'pricing', 'other')),
  status             text not null default 'idea'
                     check (status in ('idea', 'evaluating', 'committed', 'active', 'done', 'killed')),
  proposed_by        uuid not null references public.profiles (id),
  decided_by         uuid references public.profiles (id),
  decided_at         timestamptz,
  -- origins (all nullable — a pure internal idea has none)
  client_id          uuid references public.clients (id) on delete restrict,
  venture_id         uuid references public.ventures (id),
  -- coarse capacity seed (fine grain = time-cost money lines)
  est_hours_per_week numeric(5,1),
  effort_role        text check (effort_role in ('engineering', 'creative', 'sales', 'ops', 'mixed')),
  effort_starts_on   date,
  effort_ends_on     date,
  review_after       date,        -- stale-idea nudge
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- "Joe proposes, Josh decides" — anything committed or beyond needs a decider.
  constraint committed_needs_decider
    check (status in ('idea', 'evaluating', 'killed') or decided_by is not null)
);
create trigger decisions_updated_at before update on public.decisions
  for each row execute function public.set_updated_at();
create index on public.decisions (status);

create table public.decision_events (
  id           bigint generated always as identity primary key,
  decision_id  uuid not null references public.decisions (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  actor_id     uuid references public.profiles (id),
  note         text,
  created_at   timestamptz not null default now()
);
create index on public.decision_events (decision_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Money — planning layer. One polymorphic ledger of PROJECTED lines.
-- Actuals come from FreshBooks (fb_* mirrors) — never duplicated here.
-- Anti-double-count rule: reporting reads only status='open' lines; when a
-- projection realizes (FreshBooks invoice lands for that work), link it via
-- realized_by_fb_invoice_id and flip status='realized' → it leaves "potential"
-- the moment the actual appears. The rule lives in lib/money.ts + 0003 views.
-- ---------------------------------------------------------------------------
create table public.money_lines (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('revenue', 'cost')),
  cadence       text not null check (cadence in ('one_time', 'monthly')),
  amount        numeric(12,2) not null check (amount >= 0),   -- per occurrence / per MONTH
  confidence    numeric(3,2) not null default 1.00 check (confidence > 0 and confidence <= 1),
  status        text not null default 'open' check (status in ('open', 'realized', 'cancelled')),
  -- timing: one_time → occurs_on; monthly → starts_on [+ ends_on, null = open-ended]
  occurs_on     date,
  starts_on     date,
  ends_on       date,
  constraint timing_shape check (
       (cadence = 'one_time' and occurs_on is not null and starts_on is null and ends_on is null)
    or (cadence = 'monthly'  and starts_on is not null and occurs_on is null)
  ),
  constraint window_valid check (ends_on is null or ends_on >= starts_on),
  -- cost provenance (amount stays authoritative; these explain it)
  cost_basis        text check (cost_basis in ('fixed', 'unit', 'time')),
  unit_cost         numeric(12,4),
  unit_count        numeric(12,2),
  hours_per_period  numeric(6,2),
  hourly_rate       numeric(8,2),
  assignee_id       uuid references public.profiles (id),
  constraint cost_fields_only_for_costs
    check (direction = 'cost' or (cost_basis is null and assignee_id is null)),
  -- attribution: at least one anchor
  decision_id   uuid references public.decisions (id) on delete cascade,
  venture_id    uuid references public.ventures (id),
  client_id     uuid references public.clients (id) on delete restrict,
  constraint attributed check (num_nonnulls(decision_id, venture_id, client_id) >= 1),
  -- realization link (projection → the FreshBooks invoice that realized it)
  realized_by_fb_invoice_id bigint,
  realized_note text,
  category      text not null default 'general',   -- 'retainer','license','build','cogs','labor','infra','tooling',…
  memo          text,
  created_by    uuid not null references public.profiles (id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger money_lines_updated_at before update on public.money_lines
  for each row execute function public.set_updated_at();
create index on public.money_lines (decision_id);
create index on public.money_lines (venture_id);
create index on public.money_lines (client_id);
create index on public.money_lines (direction, cadence) where status = 'open';

-- Planning constants are DATA, never code ("never fabricate numbers" — unset
-- assumptions render as "not set" in the UI, never as invented defaults).
create table public.assumptions (
  key         text primary key,
  value       jsonb not null,     -- 'null'::jsonb = deliberately not set
  note        text,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FreshBooks mirrors — the actuals ledger. Synced, read-only in-app.
-- Keyed on the FreshBooks id; upserts are ON CONFLICT DO UPDATE because FB
-- records mutate (payments land, invoices void). `raw` keeps the full payload
-- for forward-compat with fields we didn't type out.
-- ---------------------------------------------------------------------------
create table public.fb_clients (
  fb_id        bigint primary key,
  organization text,
  email        text,
  raw          jsonb not null default '{}',
  synced_at    timestamptz not null default now()
);

create table public.fb_invoices (
  fb_id        bigint primary key,
  fb_client_id bigint,
  number       text,
  status       text,
  amount       numeric(12,2),
  paid         numeric(12,2),
  outstanding  numeric(12,2),
  currency     char(3) default 'USD',
  create_date  date,
  date_paid    date,
  raw          jsonb not null default '{}',
  synced_at    timestamptz not null default now()
);
create index on public.fb_invoices (fb_client_id);
create index on public.fb_invoices (create_date);

create table public.fb_payments (
  fb_id         bigint primary key,
  fb_invoice_id bigint,
  amount        numeric(12,2),
  date          date,
  type          text,
  raw           jsonb not null default '{}',
  synced_at     timestamptz not null default now()
);

create table public.fb_expenses (
  fb_id        bigint primary key,
  amount       numeric(12,2),
  category     text,
  vendor       text,
  date         date,
  fb_client_id bigint,            -- non-null = client-billable, null = company cost
  raw          jsonb not null default '{}',
  synced_at    timestamptz not null default now()
);
create index on public.fb_expenses (date);

create table public.fb_time_entries (
  fb_id            bigint primary key,
  profile_id       uuid references public.profiles (id),  -- resolved via identities
  fb_client_id     bigint,
  duration_seconds integer,
  note             text,
  started_at       timestamptz,
  billable         boolean,
  raw              jsonb not null default '{}',
  synced_at        timestamptz not null default now()
);
create index on public.fb_time_entries (started_at);

create table public.fb_estimates (
  fb_id        bigint primary key,
  fb_client_id bigint,
  status       text,
  amount       numeric(12,2),
  create_date  date,
  raw          jsonb not null default '{}',
  synced_at    timestamptz not null default now()
);

-- OAuth tokens. SERVICE-ROLE ONLY (RLS in 0003 grants no authenticated access)
-- — tokens must never reach the browser.
create table public.integration_tokens (
  provider      text primary key check (provider in ('freshbooks')),
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  account_id    text,
  business_id   text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Awareness loop
-- ---------------------------------------------------------------------------
-- Ingestion for events that have no home elsewhere (git commits, FreshBooks
-- events, manual notes). Idempotency backbone: (source, external_id) partial
-- unique — every automated write is ON CONFLICT DO NOTHING, so any poll is
-- safely replayable from scratch.
create table public.work_log (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('manual', 'git', 'freshbooks', 'other')),
  external_id  text,              -- 'org/repo@sha', 'fb:invoice:123'
  kind         text not null default 'note',  -- 'commit','note','invoice_paid','expense',…
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references public.profiles (id),
  actor_raw    text,              -- raw author string when unresolved
  title        text not null,
  body         text,
  repo_id      uuid,              -- FK added below after repos exists
  decision_id  uuid references public.decisions (id) on delete set null,
  client_id    uuid references public.clients (id) on delete set null,
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create unique index work_log_source_ext_uq on public.work_log (source, external_id)
  where external_id is not null;
create index on public.work_log (occurred_at desc);
create index on public.work_log (actor_id, occurred_at desc);

-- The "now" strip — a status line, not a task tracker.
create table public.work_items (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id),
  repo_id     uuid,               -- FK added below
  client_id   uuid references public.clients (id) on delete set null,
  title       text not null,
  note        text,
  status      text not null default 'now' check (status in ('now', 'next', 'done', 'dropped')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.work_items (profile_id, status);

-- ---------------------------------------------------------------------------
-- Repos — registry + poller cache on one row
-- ---------------------------------------------------------------------------
create table public.repos (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'github',
  org                 text not null,
  name                text not null,
  local_path          text,
  purpose             text,
  tags                text[] not null default '{}',
  category            text not null default 'internal'
                      check (category in ('client', 'product', 'internal', 'infra', 'content')),
  default_branch      text not null default 'main',
  venture_id          uuid references public.ventures (id),
  client_id           uuid references public.clients (id),
  is_active           boolean not null default true,
  -- poller-owned cache + bookkeeping (advanced only after work_log inserts land)
  last_commit_sha     text,
  last_commit_at      timestamptz,
  last_commit_author  text,
  last_commit_message text,
  last_synced_at      timestamptz,
  sync_etag           text,
  sync_error          text,
  open_pr_count       integer,
  open_issue_count    integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, org, name)
);
create trigger repos_updated_at before update on public.repos
  for each row execute function public.set_updated_at();

alter table public.work_log
  add constraint work_log_repo_fk foreign key (repo_id)
  references public.repos (id) on delete set null;
alter table public.work_items
  add constraint work_items_repo_fk foreign key (repo_id)
  references public.repos (id) on delete set null;

-- Sync job log (mirrors the queued/running/succeeded/failed job pattern).
create table public.ingest_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null check (job in ('github_poll', 'freshbooks_sync')),
  status      text not null default 'queued'
              check (status in ('queued', 'running', 'succeeded', 'failed')),
  started_at  timestamptz,
  finished_at timestamptz,
  stats       jsonb not null default '{}',
  error       text,
  created_at  timestamptz not null default now()
);
create index on public.ingest_runs (job, created_at desc);
