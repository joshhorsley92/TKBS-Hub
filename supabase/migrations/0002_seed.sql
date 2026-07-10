-- ============================================================================
-- TKBS-Hub — 0002: seed data
-- Grounded in the repo's context/ knowledge base (03-pricing, 05-ventures,
-- 08-clients) and the verified local repo inventory (2026-07-10).
-- Users + identities are NOT seeded here — auth users are created by
-- scripts/seed-users.mjs (Supabase admin API), which also seeds identities.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ventures (price sheets are planning INPUT, quoted from context docs)
-- ---------------------------------------------------------------------------
insert into public.ventures (slug, name, kind, status, price_sheet, notes) values
(
  'agency', 'TKBS Agency', 'agency_offer', 'launched',
  '[
    {"tier":"ignite","label":"Ignite","price":997,"pricing_type":"one_time"},
    {"tier":"launch","label":"Launch (flagship)","price":2997,"pricing_type":"one_time"},
    {"tier":"boost","label":"Boost","price":2500,"pricing_type":"monthly","note":"$2,500+/mo per Pricing Architecture; newer docs say ~$500/mo — unresolved discrepancy, confirm with Josh"},
    {"tier":"orbit","label":"Orbit","price":null,"pricing_type":"monthly","note":"custom (~$2,000/mo referenced elsewhere)"}
  ]'::jsonb,
  '4-stage rocket: Ignite → Launch → Boost → Orbit. 30-Day Lead Guarantee, no contracts. Boost/Orbit pricing discrepancy recorded in context/99.'
),
(
  'seasonal-stylist', 'Seasonal Stylist', 'product', 'building',
  '[
    {"tier":"free","label":"Free","price":0,"pricing_type":"monthly","note":"10 analyses/mo, <=500 products"},
    {"tier":"growth","label":"Growth","price":49,"pricing_type":"monthly","unit_cost":0.045,"note":"100 analyses/mo, ~95% margin"},
    {"tier":"pro","label":"Pro","price":199,"pricing_type":"monthly","unit_cost":0.045,"note":"unlimited (soft-cap 1000), ~92% margin"}
  ]'::jsonb,
  'Shopify app. Pricing LOCKED 2026-04-24 pending Josh sign-off. Unit cost ~$0.035–0.06/analysis. Launch partner: Clothing Cove.'
),
(
  'catalog-calibrator', 'Catalog Calibrator', 'product', 'building',
  '[
    {"tier":"trial","label":"Free trial","price":0,"pricing_type":"one_time","note":"10 products"},
    {"tier":"s","label":"Up to 100","price":19,"pricing_type":"one_time"},
    {"tier":"m","label":"101–500","price":99,"pricing_type":"one_time"},
    {"tier":"l","label":"501–2000","price":399,"pricing_type":"one_time"},
    {"tier":"xl","label":"2000+","price":null,"pricing_type":"one_time","note":"custom"}
  ]'::jsonb,
  'One-time merchant-paid AI catalog audit, spun out of Seasonal Stylist. ~75% margin. Pricing per Joe direction 2026-05-01.'
),
(
  'video-production', 'Video Production Pipeline', 'service_line', 'exploring',
  '[
    {"tier":"starter","label":"Starter","price":999,"pricing_type":"monthly","note":"2 videos/mo"},
    {"tier":"standard","label":"Standard (default proposal tier)","price":1799,"pricing_type":"monthly","note":"4 videos/mo"},
    {"tier":"pro","label":"Pro","price":2999,"pricing_type":"monthly","note":"4 videos + ad mgmt + attribution"},
    {"tier":"setup","label":"Setup fee","price":499,"pricing_type":"one_time","note":"waived on annual"}
  ]'::jsonb,
  'Short-form FB/IG video ads for existing clients. Josh approval pending. Marginal COGS ~$7–10/video; Joe''s time is the real cost. Pilot client: Foundations Tree Experts.'
);

-- ---------------------------------------------------------------------------
-- Clients — the 4 real ones (stages as of 2026-07-10 context; edit in-app)
-- ---------------------------------------------------------------------------
insert into public.clients (name, slug, stage, industry, website, contact_name, notes) values
(
  'Geek Mystique', 'geek-mystique', 'proposal',
  'Licensed geek/IP art e-commerce (Shopify + Printful POD)', null, 'Thomas Covert (Board Game Revolution)',
  'Planning/pricing phase as of Apr 2026. ~30K email list, ~500 publisher relationships. Timeline: demo site Fall 2026 → crowdfunding Jan–Feb 2027 → launch. Design: dark/immersive, per-IP themed pages. Likely starting IP: Everdell.'
),
(
  'Astro Paws (Maka Games)', 'astro-paws', 'active',
  'Tabletop games — Kickstarter', null, 'Maka Games',
  'Kickstarter pre-launch (Micro May 2026), FB+IG ads via Meta Ads Manager. 4 rounds of ad creative generated (Higgsfield), awaiting client review.'
),
(
  'Foundations Tree Experts', 'foundations-tree-experts', 'active',
  'Tree service', 'https://foundationstreeexperts.com', null,
  'Video Production pipeline pilot (Lane A — asset-first compositing from real job-site footage). Also source of the static-React reference web build.'
),
(
  'Clothing Cove', 'clothing-cove', 'active',
  'Apparel retail (brick-and-mortar + Shopify)', null, null,
  'Seasonal Stylist launch partner ("pull, not push"). Multi-million $/yr store; 3,600+ product catalog is the demo/test fixture. Co-marketing/case-study agreement pending Josh + CC sign-off.'
);

-- ---------------------------------------------------------------------------
-- Repos — verified local inventory, 2026-07-10 (11 repos, two GitHub orgs)
-- ---------------------------------------------------------------------------
insert into public.repos (provider, org, name, local_path, category, purpose, is_active) values
('github', 'joshhorsley92', 'TKBS-Hub',            'C:\TKBS-Hub',                 'internal', 'This app — internal business cockpit', true),
('github', 'tkbs-support',  'TKBS-CRM',            'C:\CRM',                      'internal', 'Legacy client-acquisition suite (CRM, Paydirt) — reference only', true),
('github', 'joshhorsley92', 'Client-Acquisition',  'C:\Client-Acquisition',       'internal', 'Next.js rebuild of the client-acquisition suite (Quarry/Scrub/MRR) — legacy', true),
('github', 'tkbs-support',  'Web-Hosting',         'C:\Web-Hosting',              'client',   'Monorepo of client website builds (geek-mystique, foundations-tree-experts, tkbs-nextjs, turnkey-business-solutions, …)', true),
('github', 'tkbs-support',  'Website-Inspiration-Hub', 'C:\Website-Inspiration-Hub', 'content', 'Knowledge base for high-end custom client websites', true),
('github', 'tkbs-support',  'TKBS-Creative-Pipeline', 'C:\TKBS-Creative-Pipeline', 'internal', '4-stage client-acquisition pipeline: discover → research → create → outreach', true),
('github', 'tkbs-support',  'SEO-AEO-Audit-and-Optimization-Pipeline', 'C:\SEO-AEO-Audit-and-Optimization-Pipeline', 'internal', 'Deterministic Python SEO/AEO/GEO audit pipeline', true),
('github', 'tkbs-support',  'tkbs-quarry',         'C:\tkbs-quarry',              'product',  'Lead-discovery engine with per-industry packs (spun out of CRM /discovery)', true),
('github', 'tkbs-support',  'tkbs-skills',         'C:\tkbs-skills',              'infra',    'Private Claude Code skills plugin marketplace', true),
('github', 'joshhorsley92', 'TKBS-Custom-Apps',    'C:\Users\motor\source\repos\TKBS-Custom-Apps', 'product', 'Standalone shippable apps (Shopify App Store, bespoke deliverables)', true),
('local',  'local',         'TKBS-Obsidian-Files', 'C:\TKBS-Obsidian-Files',      'content',  'Obsidian knowledge vault (no remote — excluded from GitHub sync)', false);

-- NOTE: Web-Hosting is a monorepo hosting MANY client sites — per-site client
-- links are a Phase 3 concern (sub-site tracking), so no client_id is set here.

-- Link product repos to ventures
update public.repos r set venture_id = v.id
from public.ventures v
where (r.name = 'TKBS-Custom-Apps' and v.slug = 'seasonal-stylist');

-- ---------------------------------------------------------------------------
-- Assumptions — planning constants as data. NULL value = deliberately unset:
-- the UI must render "not set", never an invented default (Josh rule).
-- ---------------------------------------------------------------------------
insert into public.assumptions (key, value, note) values
('blended_hourly_rate',   '100'::jsonb,  'Documented planning number ($100/hr blended) — from the 2026-04-10 ecosystem plan. Confirm with Josh before load-bearing use.'),
('weekly_capacity_hours', 'null'::jsonb, 'Hours/week each person can commit. NOT SET — Josh to set in Settings.'),
('pipeline_confidence',   'null'::jsonb, 'Win-probability weights for potential revenue (e.g. {"evaluating":0.3,"committed":0.9}). NOT SET — Josh to set in Settings.');
