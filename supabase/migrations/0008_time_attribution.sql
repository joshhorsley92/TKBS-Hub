-- ============================================================================
-- TKBS-Hub — 0008: who did the work, and who it was for
--
-- Two flaws in 0007, both found by Josh, both of the same species: the system
-- was quietly ASSUMING an answer it did not have.
--
-- 1. WHO. The hook authenticates with the shared SYNC_SECRET, which carries no
--    identity. The API fell through to DEV_USER and logged EVERY session as
--    Joe. If Josh ran Claude Code, his hours landed on Joe's ledger and nothing
--    said so. Silent misattribution is worse than no data, because it looks
--    like data.
--
--    Fix: resolve the person from the machine's `git config user.email` via the
--    `identities` table — the same mapping that already attributes commits. If
--    it can't be resolved, profile_id is NULL and the raw email is kept, so the
--    board can ASK instead of guessing.
--
-- 2. FOR WHOM. `repos.client_id` is a single FK, which works for a dedicated
--    repo (Foundations-Tree-Experts) and breaks for a shared one. TKBS-Creative-
--    Pipeline serves many clients; work in it is not "generic pipeline work",
--    it's work FOR a client.
--
--    Fix: for a repo with no dedicated client, the hook asks Claude to name the
--    client from the session's own prompts, matched against the real client
--    list. That lands as a SUGGESTION — never as an assertion. A human confirms
--    it with one click. Nothing is ever booked to a client on a guess.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. WHO
-- ---------------------------------------------------------------------------

-- An unidentified session is a real state. It must be storable, not guessed.
alter table public.time_sessions alter column profile_id drop not null;

-- What we saw but couldn't resolve — e.g. a git email with no identity mapping.
-- Keeping it means the board can say "this was someone using
-- x@y.com — who is that?" instead of silently picking a name.
alter table public.time_sessions add column if not exists actor_raw text;

comment on column public.time_sessions.profile_id is
  'Who did the work. NULL = we could not identify them. Never guessed — see actor_raw.';

-- ---------------------------------------------------------------------------
-- 2. FOR WHOM
-- ---------------------------------------------------------------------------

-- A SUGGESTION, not an attribution. Nothing sums over this column — it exists
-- purely so a human can confirm it into client_id with one click.
alter table public.time_sessions
  add column if not exists suggested_client_id uuid references public.clients(id) on delete set null;
alter table public.time_sessions
  add column if not exists suggested_reason text;

comment on column public.time_sessions.suggested_client_id is
  'Which client this work LOOKS like it was for, inferred from the session prompts. A suggestion awaiting human confirmation — it is never counted as attribution and no view sums over it.';

-- ---------------------------------------------------------------------------
-- v_time_session_cost — must LEFT JOIN profiles now that the person can be
-- unknown. An inner join would silently hide unidentified sessions, which is
-- exactly the failure mode this migration exists to fix.
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced: `s.*` now carries the new columns, which shifts
-- the view's shape, and CREATE OR REPLACE cannot reshape a view.
drop view if exists public.v_time_monthly;
drop view if exists public.v_time_session_cost;

create view public.v_time_session_cost with (security_invoker = true) as
select
  s.*,
  round(s.worked_seconds / 3600.0, 3)                     as worked_hours,
  p.hourly_rate,
  round((s.worked_seconds / 3600.0) * p.hourly_rate, 2)   as labour_cost,
  (s.input_tokens + s.output_tokens + s.cache_read_tokens
     + s.cache_write_5m_tokens + s.cache_write_1h_tokens) as total_tokens
from public.time_sessions s
left join public.profiles p on p.id = s.profile_id;

create view public.v_time_monthly with (security_invoker = true) as
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
  round(
    (select monthly from sub)
      * sum(s.input_tokens + s.output_tokens + s.cache_read_tokens
            + s.cache_write_5m_tokens + s.cache_write_1h_tokens)
      / nullif(mt.tokens, 0),
    2
  ) as allocated_cost
from public.time_sessions s
left join public.profiles p on p.id = s.profile_id
left join month_tokens mt on mt.month = date_trunc('month', s.started_at)::date
group by 1, 2, 3, mt.tokens;

-- ---------------------------------------------------------------------------
-- 3. The subscription. ONE $200/mo Max plan, shared by Joe and Josh — so the
-- allocation denominator is every token BOTH of them spent that month, which is
-- what v_time_monthly already does. This is a real figure, given by Josh.
-- ---------------------------------------------------------------------------
update public.assumptions
   set value = '200'::jsonb,
       note  = 'Claude Max, $200/mo, shared by Joe and Josh. Real monthly spend — allocated across clients pro-rata by token share.',
       updated_at = now()
 where key = 'claude_subscription_monthly';
