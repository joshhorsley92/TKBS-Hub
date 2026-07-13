-- ============================================================================
-- TKBS-Hub — 0007: time tracking
--
-- Tracks hours worked per client/project, and what those hours COST — both the
-- human's time and the Claude tokens the work consumed.
--
-- THE COST MODEL (this is the part that's easy to get wrong):
--
--   labour     = worked_hours × profiles.hourly_rate.        REAL CASH.
--   imputed    = tokens priced at Anthropic API list price.  NOTIONAL — this
--                money was never spent. Claude Code here bills against a
--                subscription (lib/claude-bridge.ts strips ANTHROPIC_API_KEY on
--                purpose), so the marginal cash cost of a token is ZERO. Imputed
--                answers "what would this have cost on the API?" — the number
--                that matters when pricing work or deciding to productise it.
--   allocated  = the REAL monthly subscription bill, split across clients
--                pro-rata by token share. REAL CASH. Answers "what did it
--                actually cost us to serve them?"
--
-- Imputed and allocated are NEVER summed. They are two answers to two different
-- questions, and adding them double-counts — the same discipline the Money page
-- already applies to actual-vs-projected revenue.
--
-- The subscription figure is NOT invented: it lives in `assumptions` as
-- claude_subscription_monthly and starts NULL. Until a human enters what they
-- actually pay, allocated cost is unknown and renders as "—".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What a person's hour costs. NULL = we haven't been told, and it renders as
-- "—". It never renders as $0, which would claim their time is free.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists hourly_rate numeric(8, 2);

comment on column public.profiles.hourly_rate is
  'Internal cost of one hour of this person''s time. NULL = unknown, not free.';

update public.profiles set hourly_rate = 25  where role = 'engineer' and hourly_rate is null;
update public.profiles set hourly_rate = 200 where role = 'owner'    and hourly_rate is null;
-- Savannah's rate is deliberately left NULL — nobody has told us what it is.

-- ---------------------------------------------------------------------------
-- Model pricing — a table, not a constant, because Anthropic's prices change
-- and nobody should need a deploy to correct them.
-- $ per MILLION tokens.
-- ---------------------------------------------------------------------------
create table if not exists public.model_pricing (
  model                    text primary key,
  input_per_mtok           numeric(10, 4) not null,
  output_per_mtok          numeric(10, 4) not null,
  cache_read_per_mtok      numeric(10, 4) not null,
  cache_write_5m_per_mtok  numeric(10, 4) not null,
  cache_write_1h_per_mtok  numeric(10, 4) not null,
  note                     text,
  updated_at               timestamptz not null default now()
);

-- Cache reads are ~0.1× base input; 5-minute cache writes 1.25×, 1-hour 2×.
insert into public.model_pricing
  (model, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_5m_per_mtok, cache_write_1h_per_mtok, note) values
  ('claude-opus-4-8',  5.00, 25.00, 0.50, 6.25, 10.00, 'Opus 4.8 list price'),
  ('claude-opus-4-7',  5.00, 25.00, 0.50, 6.25, 10.00, 'Opus 4.7 list price'),
  ('claude-sonnet-5',  3.00, 15.00, 0.30, 3.75,  6.00, 'Sonnet 5 standard list; intro pricing ($2/$10) runs to 2026-08-31'),
  ('claude-haiku-4-5', 1.00,  5.00, 0.10, 1.25,  2.00, 'Haiku 4.5 list price')
on conflict (model) do nothing;

-- ---------------------------------------------------------------------------
-- A tracked session.
--
-- For Claude Code work this is one chat window, keyed by its session id. The
-- hook RECOMPUTES the whole row from the transcript on every turn and upserts —
-- so a session that crashes, or is never closed cleanly, still has correct
-- totals up to its last turn. The transcript is the event log; this is a
-- derived cache of it.
--
-- For everything else — Josh on a sales call, Savannah in FreshBooks — the same
-- table holds a hand-entered row. One shape, many sources.
-- ---------------------------------------------------------------------------
create table if not exists public.time_sessions (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'manual'
                 check (source in ('claude', 'manual', 'freshbooks')),
  -- The Claude Code session id. Unique so the hook's repeated upserts converge
  -- on one row instead of piling up.
  external_id  text unique,

  profile_id   uuid not null references public.profiles(id),

  -- Attribution. All three may be NULL — an unattributed session is a real
  -- state (Claude ran somewhere the hub doesn't know about), and the UI offers
  -- it up to be assigned rather than guessing.
  client_id    uuid references public.clients(id)  on delete set null,
  venture_id   uuid references public.ventures(id) on delete set null,
  repo_id      uuid references public.repos(id)    on delete set null,

  started_at   timestamptz not null,
  ended_at     timestamptz,

  -- Derived by the idle rule: the clock runs across the conversation, and any
  -- gap longer than 15 minutes between Claude's output and the next human input
  -- is excluded. Long Claude runs count in full — by design; see 0007 notes.
  worked_seconds integer not null default 0 check (worked_seconds >= 0),
  idle_seconds   integer not null default 0 check (idle_seconds >= 0),

  model              text,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_5m_tokens bigint not null default 0,
  cache_write_1h_tokens bigint not null default 0,

  -- Priced at API list at write time, so a later price change doesn't silently
  -- rewrite history. NOTIONAL — see the header.
  imputed_cost numeric(12, 4),

  /** One line, AI-written on the machine that ran the session. The transcript
      itself never leaves that machine. */
  summary text,
  cwd     text,
  note    text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_sessions_client_idx  on public.time_sessions (client_id);
create index if not exists time_sessions_profile_idx on public.time_sessions (profile_id);
create index if not exists time_sessions_started_idx on public.time_sessions (started_at desc);

-- ---------------------------------------------------------------------------
-- What we actually pay Anthropic each month. NULL until a human says.
-- Without it, allocated cost is unknown — and says so.
-- ---------------------------------------------------------------------------
insert into public.assumptions (key, value, note) values
  ('claude_subscription_monthly', 'null'::jsonb,
   'Real monthly Claude subscription spend, in dollars. Used to allocate actual cost across clients pro-rata by token share. NULL = not told yet; allocated cost renders as "—".')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- v_time_session_cost — one row per session, with labour and imputed cost.
--
-- labour is NULL when the person has no rate on file. That is not zero.
-- ---------------------------------------------------------------------------
create or replace view public.v_time_session_cost with (security_invoker = true) as
select
  s.*,
  round(s.worked_seconds / 3600.0, 3)                        as worked_hours,
  p.hourly_rate,
  round((s.worked_seconds / 3600.0) * p.hourly_rate, 2)      as labour_cost,
  (s.input_tokens + s.output_tokens + s.cache_read_tokens
     + s.cache_write_5m_tokens + s.cache_write_1h_tokens)    as total_tokens
from public.time_sessions s
join public.profiles p on p.id = s.profile_id;

-- ---------------------------------------------------------------------------
-- v_time_monthly — per month × client: hours, labour, imputed, and the
-- pro-rata slice of the REAL subscription bill.
--
-- The allocation denominator is every token spent that month, attributed or
-- not — so an unattributed session dilutes everyone honestly rather than being
-- silently redistributed onto the clients we happen to know about.
-- ---------------------------------------------------------------------------
create or replace view public.v_time_monthly with (security_invoker = true) as
with sub as (
  select nullif(value, 'null'::jsonb)::numeric as monthly
  from public.assumptions where key = 'claude_subscription_monthly'
),
month_tokens as (
  select date_trunc('month', started_at)::date as month,
         sum(input_tokens + output_tokens + cache_read_tokens
             + cache_write_5m_tokens + cache_write_1h_tokens) as tokens
  from public.time_sessions
  group by 1
)
select
  date_trunc('month', s.started_at)::date as month,
  s.client_id,
  s.profile_id,
  sum(s.worked_seconds)                                      as worked_seconds,
  round(sum(s.worked_seconds) / 3600.0, 2)                   as worked_hours,
  round(sum((s.worked_seconds / 3600.0) * p.hourly_rate), 2) as labour_cost,
  round(sum(s.imputed_cost), 2)                              as imputed_cost,
  sum(s.input_tokens + s.output_tokens + s.cache_read_tokens
      + s.cache_write_5m_tokens + s.cache_write_1h_tokens)   as total_tokens,
  -- Real cash: this client's share of the month's subscription bill.
  -- NULL when nobody has entered what the subscription costs — which is the
  -- honest state until someone does.
  round(
    (select monthly from sub)
      * sum(s.input_tokens + s.output_tokens + s.cache_read_tokens
            + s.cache_write_5m_tokens + s.cache_write_1h_tokens)
      / nullif(mt.tokens, 0),
    2
  ) as allocated_cost
from public.time_sessions s
join public.profiles p on p.id = s.profile_id
left join month_tokens mt on mt.month = date_trunc('month', s.started_at)::date
group by 1, 2, 3, mt.tokens;

-- ---------------------------------------------------------------------------
-- RLS — same posture as the rest of the board.
-- ---------------------------------------------------------------------------
alter table public.time_sessions enable row level security;
alter table public.model_pricing enable row level security;

do $$ begin
  drop policy if exists members_all on public.time_sessions;
  create policy members_all on public.time_sessions for all to authenticated
    using (public.is_hub_user()) with check (public.is_hub_user());

  drop policy if exists members_read on public.model_pricing;
  create policy members_read on public.model_pricing for select to authenticated
    using (public.is_hub_user());
end $$;
