-- ============================================================================
-- TKBS-Hub — 0009: "TKBS Internal" is an ANSWER, not a gap
--
-- Until now "unattributed" meant two different things, and the board couldn't
-- tell them apart:
--
--   * "we don't know who this was for"  — a gap. Needs a human.
--   * "it was internal"                 — a decided, correct answer.
--
-- Conflating them means internal work sits in the Needs-Attributing queue
-- forever, nagging about something already settled. So internal gets a home.
--
-- It is a VENTURE, not a client. `ventures.kind = 'internal'` already exists for
-- exactly this. Making it a client would put a fake company on the client
-- roster and a $0 row in the revenue table — TKBS does not pay itself.
--
-- With the repo mapped to it, internal sessions attribute THEMSELVES with no
-- guessing at all: the repo is the answer. Zero clicks, zero inference.
-- ============================================================================

insert into public.ventures (slug, name, kind, status, blurb, notes)
select
  'tkbs-internal',
  'TKBS Internal',
  'internal',
  'launched',
  'The company''s own work — the hub, the CRM, tooling, infrastructure. Not billable to anyone; this is what it costs TKBS to run TKBS.',
  'Catch-all bucket so internal hours are CATEGORISED rather than sitting unattributed. Named products (Seasonal Stylist, Catalog Calibrator) have their own venture and should be attributed there instead.'
where not exists (select 1 from public.ventures where slug = 'tkbs-internal');

-- ---------------------------------------------------------------------------
-- Point the genuinely-internal repos at it.
--
-- This also closes a seam that has been open since the redesign: repos.venture_id
-- was NULL everywhere, so no commit rolled up to any build. Now they do.
--
-- LISTED EXPLICITLY, not matched on category, because category lies here:
-- TKBS-Creative-Pipeline is filed as 'internal' but its work belongs to
-- CLIENTS (Josh, 2026-07-13). A blanket category rule would silently book every
-- hour of creative work as company overhead — precisely the failure this
-- migration exists to prevent.
-- ---------------------------------------------------------------------------
update public.repos r
   set venture_id = v.id
  from public.ventures v
 where v.slug = 'tkbs-internal'
   and r.venture_id is null
   and r.name in (
     'TKBS-Hub',
     'TKBS-CRM',
     'Client-Acquisition',
     'tkbs-skills',
     'Electrician-CRM',
     'Options-Trader',
     'Shopify-Website-Builder',
     'SEO-AEO-Audit-and-Optimization-Pipeline',
     'Website-Inspiration-Hub'
   );

-- ---------------------------------------------------------------------------
-- TKBS-Creative-Pipeline is client work with a shared codebase.
--
-- Filed as 'internal', which is wrong: the pipeline is the tool, but the WORK is
-- for a client. Recategorising it to 'client' while leaving client_id NULL is
-- the exact signal the tracker needs — "this repo does client work, but WHICH
-- client varies per session" — and it's what makes the hook ask Claude to read
-- the session's prompts and name the client instead of shrugging.
-- ---------------------------------------------------------------------------
update public.repos
   set category = 'client'
 where name = 'TKBS-Creative-Pipeline';

comment on column public.repos.client_id is
  'The client this repo is dedicated to. NULL on a SHARED client repo (e.g. TKBS-Creative-Pipeline) — the work belongs to a client, but which one varies per session, so it is resolved per-session rather than per-repo.';
