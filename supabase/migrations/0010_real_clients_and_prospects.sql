-- The Hub's client list, reconciled against what the repos actually show.
--
-- Before this, the Hub knew 4 clients and 0 prospects. That was not the truth —
-- it was just everything anyone had gotten around to typing in. Meanwhile six
-- repos carried category='client' with no client_id, and 158 of the 166 hours
-- the time tracker backfilled came back unattributed, because the clients the
-- work was FOR did not exist as rows.
--
-- Every row below is evidenced. The evidence is named in the comment above it.
-- Where a fact was not in a file, the column is NULL — never a guess. Three
-- sources, in order of authority:
--
--   1. TKBS-Creative-Pipeline/dashboard/clients.json — self-described as the
--      "canonical 'all clients ever worked on' roster ... source of truth".
--   2. The repos + their commit history (work_log) — what was actually BUILT.
--      This is how Honest Mortgage, Sunsy and RMD surfaced: real delivered work
--      that the roster in (1) never knew about, because it predates or sits
--      outside the Creative Pipeline.
--   3. TKBS-Creative-Pipeline/potential-clients/*.json + prospects/<slug>/ —
--      the prospect spine and its dossiers.

begin;

/* ── CLIENTS ──────────────────────────────────────────────────────────────
   Five new. Four of the five come from Josh's work, not from any roster:
   he built these and the Hub never knew.                                    */

insert into public.clients (name, slug, stage, industry, website, contact_name, contact_email, contact_phone, since, engagement, notes)
values
  -- 44 commits by Josh, 2026-07-02 → 2026-07-11 (repo Honest-Mortgage-Website,
  -- category 'client'): apply funnel, live rate board + compliance reframe, refi
  -- calculator, partners/careers pages, reviews carousel, de-AI copy pass. A full
  -- mortgage-broker site build, and the most active client engagement TKBS has.
  -- No domain or contact is recorded anywhere on this machine, so both stay NULL.
  ('Honest Mortgage', 'honest-mortgage', 'active', 'Mortgage brokerage',
   null, null, null, null, date '2026-07-02',
   'Website build (apply funnel, rate board, refi calculator)',
   'Full website build. 44 commits by Josh 2026-07-02 → 2026-07-11 across Honest-Mortgage-Website (+ a second repo, Honest-Mortgage). Not on any client roster — surfaced from the commit history. Domain and contact unknown: not recorded in any repo. CONFIRM with Josh.'),

  -- Sunsy-Content-Pipeline/CLAUDE.md, line 8, verbatim: "A paid TKBS client
  -- engagement for Derek Antosiek (blog Optimize Your Biology; co-founder of
  -- Sunsy)." Two repos: Sunsy-Content-Pipeline (21 commits, May) and
  -- Sunsy-Klaviyo-Welcome-Flows (2 commits by Josh, June).
  ('Sunsy (Derek Antosiek)', 'sunsy', 'active', 'Health/biohacking content + circadian lighting',
   'https://sunsy.co', 'Derek Antosiek', null, null, date '2026-05-16',
   'Content pipeline + Klaviyo welcome flows',
   'Called "a paid TKBS client engagement" in Sunsy-Content-Pipeline/CLAUDE.md. Blog: optimizeyourbiology.com. Repos: Sunsy-Content-Pipeline (21 commits), Sunsy-Klaviyo-Welcome-Flows (2, Josh). Caveat from that repo''s ROADMAP: the current phase is framed as "a sales demo to win Derek''s agreement", with production work deferred "only after Derek signs off" — so the scope of what is actually paid for needs confirming.'),

  -- Repo RMD-Klaviyo-Integration (category 'client'), 1 commit by Josh 2026-07-01.
  -- Plus a full ecommerce SEO/AEO audit on file: SEO-AEO-Audit-and-Optimization-
  -- Pipeline/docs/project-progress.md → "RMD Jewelry … https://www.rmdjewelry.com/".
  ('RMD Jewelry', 'rmd-jewelry', 'active', 'Handcrafted jewelry (e-commerce)',
   'https://www.rmdjewelry.com', null, null, null, date '2026-07-01',
   'Klaviyo integration + SEO/AEO audit',
   'Klaviyo integration repo (Josh, 2026-07-01) and a full ecommerce SEO/AEO audit. Also stocked by Clothing Cove ("handcrafted Rachel Marie Designs pieces"), which is likely how the relationship came about.'),

  -- C:\Web-Hosting/champion-gasket — a complete multi-page Astro site (about,
  -- contact, quality, request-quote, products, industries) committed by Josh on
  -- 2026-04-20 into the repo whose README reads "Host Client TKBS Websites".
  -- Phone from the site's own copy.
  ('Champion Gasket & Rubber', 'champion-gasket', 'active', 'Custom die-cut manufacturing (gaskets, seals, shims)',
   null, null, null, '248-624-6140', date '2026-04-20',
   'Website build',
   'Full multi-page site built and hosted in Web-Hosting (committed by Josh, 2026-04-20). ISO 9001:2015 certified die-cut manufacturer in Walled Lake, MI. On no roster and in no Obsidian note — the site is the only record. STAGE IS A PLACEHOLDER: the build shipped, but nothing on file says whether the engagement is ongoing or finished. CONFIRM with Josh.'),

  -- clients.json: type "client", status "Inbound lead", "Flipped cold -> inbound
  -- client lead (2026-06-26)". Work delivered (visibility audit), but not a signed
  -- engagement — hence 'discovery', not 'active'.
  ('Grady''s Garden', 'gradys-garden', 'discovery', 'Garden center',
   'https://www.gradysgarden.com', null, 'info@gradysgarden.com', null, date '2026-06-01',
   'Visibility audit + A/B ads',
   'Flipped cold → inbound client lead (2026-06-26) — TKBS''s one genuine cold-to-client conversion. Howell, MI. Visibility audit complete (SEO 75.8 / AEO 62.7 / GEO 55.4 — branded-strong but category-invisible). A 2x2 A/B ad plan (4 ads) is staged; renders pending.')
on conflict (slug) do nothing;

/* ── ENRICH THE FOUR THE HUB ALREADY HAD ──────────────────────────────────
   They were name + stage + industry and nothing else. Everything added here is
   verbatim from clients.json / context/08-clients.md.                        */

update public.clients set
  website      = 'https://maka.games',
  contact_name = 'Maka Games',
  since        = date '2026-01-01',
  engagement   = 'Kickstarter pre-launch + Meta ads',
  notes        = '"Astro Paws" — space-themed strategic card game (2-4 players, ages 8+, ~15 min). Ad tagline: "The Cutest Card Game in Space." Kickstarter pre-launch for Micro May 2026; Facebook + Instagram ads via Meta Ads Manager. Ad creatives generated (4 rounds, Higgsfield Marketing Studio, 5 characters), awaiting client review.'
where slug = 'astro-paws';

update public.clients set
  since      = date '2026-01-01',
  engagement = 'Seasonal Stylist launch partner',
  notes      = 'PARTNER, not a paying client — clients.json records type "partner", status "Launch partner". Committed launch partner for the Seasonal Stylist app ("pull, not push" — actively asking for it). Multi-million-$/yr store, brick-and-mortar + in-store styling staff. Their real 3,600+ product catalog is the demo/test fixture. Co-marketing/case-study agreement pending Josh + CC sign-off.'
where slug = 'clothing-cove';

update public.clients set
  contact_phone = '734-474-3336',
  since         = date '2026-01-01',
  engagement    = 'Video production (asset-first compositing)',
  notes         = 'Tree service with strong real job-site footage (chainsaws, climbers, crane lifts, before/after) but poor-quality FB ads. The motivating client for the TKBS Video Production pipeline (Lane A). Example concept: "26 Years. Zero Shingles." New website launched 2026-05-12; Meta ads running on the FPM ad account. TKBS rejects generic AI-video for real-trade clients.'
where slug = 'foundations-tree-experts';

update public.clients set
  since      = date '2026-04-01',
  engagement = 'Web design + crowdfunding',
  notes      = 'Officially-licensed geek/IP art as premium prints, apparel, accessories (likely starting IP: Everdell). ~30K email list, ~500 publisher relationships. Timeline: demo site Fall 2026 → crowdfunding Jan–Feb 2027 → launch. Dark/immersive per-IP themed pages. This client''s discovery note is the canonical TKBS 8-section discovery template.'
where slug = 'geek-mystique';

/* ── REPO → CLIENT ────────────────────────────────────────────────────────
   This is the part that makes time attribute itself. Six repos were tagged
   category='client' with a NULL client_id, so every Claude session in them
   landed unattributed and the tracker had to ask a human. Now the repo answers
   the question outright and nothing has to be guessed.                       */

update public.repos r set client_id = c.id
from public.clients c
where c.slug = 'honest-mortgage' and r.name in ('Honest-Mortgage', 'Honest-Mortgage-Website');

update public.repos r set client_id = c.id
from public.clients c
where c.slug = 'sunsy' and r.name in ('Sunsy-Content-Pipeline', 'Sunsy-Klaviyo-Welcome-Flows');

update public.repos r set client_id = c.id
from public.clients c
where c.slug = 'rmd-jewelry' and r.name = 'RMD-Klaviyo-Integration';

-- tkbs-quarry ("lead-discovery engine spun out of the CRM") and the Obsidian
-- vault are internal, and were the last two unclassified internal repos.
update public.repos r set venture_id = v.id
from public.ventures v
where v.name = 'TKBS Internal' and r.name in ('tkbs-quarry', 'TKBS-Obsidian-Files');

-- Web-Hosting is DELIBERATELY left unmapped, like TKBS-Creative-Pipeline: it is a
-- monorepo of several clients' sites (geek-mystique, foundations-tree-experts,
-- champion-gasket) alongside TKBS's own. Pinning it to one client would silently
-- misattribute every session in it. Leaving client_id NULL is what makes the
-- tracker ask Claude which client the session was actually for.
--
-- Customer-Dashboards is also left alone: it is tagged 'client' but its two
-- commits ("portal app with security hardening") name no client, and guessing one
-- is exactly the failure this migration exists to fix.

/* ── PROSPECTS ────────────────────────────────────────────────────────────
   From the potential-clients JSON spine + each prospect's 01-discovery.md.

   Deliberately EXCLUDED:
     * the 84 stage-'discovered' records — raw Google Places sweep output, zero
       human contact. TKBS's own stage ladder treats discovered ≠ prospect, and
       clients.json states the roster carries "NO prospect PII". They are a cold
       list, not a pipeline. Importable later if wanted.
     * spikeball, tkbs — test fixtures. Both have outreach addressed to Josh's own
       inbox, and Spikeball's engine project is literally "smoke-test".
     * maka-games, gradys-garden — already clients above.
     * fun-4-all-comics-games — duplicate spine record for the same Ypsilanti shop
       already carried as fun-4-all.

   `fit` is left NULL on every row ON PURPOSE. The spine's `score` is a
   visible-signal pre-screen — the dossiers say so in as many words: "Discovery
   fit score: 25 (visible-signal pre-screen; full Fit Score comes from Paydirt)".
   The leads.fit column is the 0-100 CRM Fit Score. Copying one into the other
   would invent a score nobody ever computed. The pre-screen number is kept in the
   note, where it can't be mistaken for the real thing.

   Likewise est_value: no engagement value is recorded anywhere, so it stays NULL.

   STAGE: 'qualified' means an outreach email actually went to the business.
   Three records the spine calls 'contacted'/'created' have an outreach email
   addressed to joshhorsley92@gmail.com — a self-send preview, not contact. Those
   are 'new', and the note says why.                                           */

insert into public.leads (name, stage, industry, contact, note) values
  ('3D Electric LLC', 'qualified', 'electrician', '3delectric@comcast.net', 'Real owner-run electrical contractor in Belleville MI (generators, EV charging, commercial, troubleshooting) with weak digital infrastructure: dated Wix site, no tracking pixel, near-invisible Google presence. Verified email reachable. Demand unconfirmed via Google reviews - Paydirt to confirm. Discovery fit score 21 (pre-screen — not a Paydirt Fit Score). Site: www.3delectric.net Source: TKBS-Creative-Pipeline prospect spine (3d-electric-llc), stage "contacted".'),
  ('Anchor Cleaning', 'new', null, null, 'Creative built, but the outreach email on file is addressed to Josh — a self-send preview, so contact with the business is unconfirmed. Source: TKBS-Creative-Pipeline prospect spine (anchor-cleaning), stage "created".'),
  ('Avera Realty', 'qualified', null, 'kristas113@gmail.com', 'Site: averarealty.com Source: TKBS-Creative-Pipeline prospect spine (avera-realty), stage "contacted".'),
  ('Clay by Clark', 'qualified', 'retail/e-commerce (handmade jewelry + kids apparel)', 'claybyclark@outlook.com', 'Healthy, in-demand family-run MI product brand (17K IG) on a basic Shopify store — TKBS Traffic->Capture->Nurture->Convert system fit Site: blakeandmia.com Source: TKBS-Creative-Pipeline prospect spine (clay-by-clark), stage "contacted".'),
  ('Collectibles Unlimited Clio', 'qualified', 'collectibles and card store', 'matfarr1@yahoo.com', 'Clio collectibles/cards, 4.7 stars 98 reviews, FB+eBay only no website Discovery fit score 30 (pre-screen — not a Paydirt Fit Score). Site: www.facebook.com/collectiblesunlimitedclio Source: TKBS-Creative-Pipeline prospect spine (collectibles-unlimited-clio), stage "contacted".'),
  ('Deer Camp Coffee', 'new', null, null, 'Site: deercampcoffee.com Creative built, but the outreach email on file is addressed to Josh — a self-send preview, so contact with the business is unconfirmed. Source: TKBS-Creative-Pipeline prospect spine (deer-camp-coffee), stage "created".'),
  ('Digital Dream Studios', 'qualified', null, 'DigitalDreamStudiosLLC@yahoo.com', 'Site: www.digitaldreamstudios.org Source: TKBS-Creative-Pipeline prospect spine (digital-dream-studios), stage "contacted".'),
  ('Fanfare', 'qualified', 'comic and game store', 'info@fanfareland.com', 'Kalamazoo comics/games, 4.7 stars 1357 reviews, real site not advertising Discovery fit score 26 (pre-screen — not a Paydirt Fit Score). Site: fanfareland.com Source: TKBS-Creative-Pipeline prospect spine (fanfare), stage "contacted".'),
  ('Fascination Factory', 'new', null, null, 'Site: www.fascinationfactory.com Source: TKBS-Creative-Pipeline prospect spine (fascination-factory), stage "researched".'),
  ('Fun 4 All Comics & Games', 'qualified', null, 'fun4RN@yahoo.com', 'Site: f4ahobbies.com Source: TKBS-Creative-Pipeline prospect spine (fun-4-all), stage "contacted".'),
  ('Island Lake Candle Co', 'new', null, null, 'Site: www.islandlakecandleco.com Creative built, but the outreach email on file is addressed to Josh — a self-send preview, so contact with the business is unconfirmed. Source: TKBS-Creative-Pipeline prospect spine (island-lake-candle-co), stage "contacted".'),
  ('Pandemonium Games and Hobbies', 'qualified', 'game and hobby store', 'managers@pandogames.com', 'Garden City game+hobby, 4.6 stars 1366 reviews, real site not advertising Discovery fit score 26 (pre-screen — not a Paydirt Fit Score). Site: www.pandogames.com Source: TKBS-Creative-Pipeline prospect spine (pandemonium-games-and-hobbies), stage "contacted".'),
  ('Retro-Taku Videogames', 'new', 'video game store', null, 'Madison Heights retro/import video game store, 4.7 stars 671 reviews, no website Discovery fit score 30 (pre-screen — not a Paydirt Fit Score). Site: www.facebook.com/Retrotakugames Source: TKBS-Creative-Pipeline prospect spine (retro-taku-videogames), stage "researched".'),
  ('Riker''s Dog Treats', 'qualified', null, 'rikersdogtreats@gmail.com', 'Site: www.rikersdogtreats.com Source: TKBS-Creative-Pipeline prospect spine (rikers-dog-treats), stage "contacted".'),
  ('Schuil Coffee', 'qualified', null, 'info@schuilcoffee.com', 'Site: schuilcoffee.com Source: TKBS-Creative-Pipeline prospect spine (schuil-coffee), stage "contacted".'),
  ('Simply Charming Too', 'new', 'retail', null, '4.9-star, 58-review women''s clothing boutique in Howell MI with NO website; proven local demand, zero digital presence; owner also runs a second storefront (Simply Home), signaling a growing operator Discovery fit score 30 (pre-screen — not a Paydirt Fit Score). Site: www.facebook.com/simplycharmingtoo Source: TKBS-Creative-Pipeline prospect spine (simply-charming-too), stage "researched".'),
  ('Stealth Outdoors', 'qualified', null, 'louis@stealthoutdoors.com', 'Source: TKBS-Creative-Pipeline prospect spine (stealth-outdoors), stage "contacted".'),
  ('Stockist Coffee', 'qualified', null, 'genevieve@coffeeexpressco.com', 'Site: www.stockistcoffee.com Source: TKBS-Creative-Pipeline prospect spine (stockist-coffee), stage "contacted".'),
  ('The Arcade', 'qualified', 'arcade', 'thearcadebrighton@gmail.com', 'Brighton pinball/retro arcade bar, 4.6 stars 840 reviews (strong demand), Facebook-only presence, no real website Discovery fit score 25 (pre-screen — not a Paydirt Fit Score). Site: www.facebook.com/thearcadebrighton Source: TKBS-Creative-Pipeline prospect spine (the-arcade), stage "contacted".'),
  ('The Beach House at Lake Street', 'qualified', 'vacation rental / boutique resort (hospitality)', 'info@lakemichiganbeachhouse.com', 'Award-winning 8-unit boutique resort in Holland MI with verified email; proven demand (booking engine, golf partnership), prime candidate for paid social ads Site: www.lakemichiganbeachhouse.com Source: TKBS-Creative-Pipeline prospect spine (the-beach-house-at-lake-street), stage "contacted".'),
  ('The Upkeep Games - Howell', 'qualified', 'game store', 'info@theupkeepgames.com', 'Howell Livingston game store, 4.6 stars 411 reviews, site not advertising Discovery fit score 26 (pre-screen — not a Paydirt Fit Score). Site: www.theupkeepgames.com Source: TKBS-Creative-Pipeline prospect spine (the-upkeep-games-howell), stage "contacted".'),
  ('Tiffany Huff Real Estate', 'qualified', null, 'tiffanyrealestateco@gmail.com', 'Site: www.facebook.com/tiffanyhuffrealestate Source: TKBS-Creative-Pipeline prospect spine (tiffany-huff-real-estate), stage "contacted".'),
  ('Twist of Sweet Heat', 'qualified', null, 'poppashotsauce@yahoo.com', 'Site: www.twistofsweetheat.com Source: TKBS-Creative-Pipeline prospect spine (twist-of-sweet-heat), stage "contacted".'),
  ('Village Estate Sales', 'new', 'estate sales / liquidation', null, 'Estate-sale service line of Village Real Estate Group, run by Michelle Lynn Greig (separate contact). Commission-based full-service estate sales + cleanouts; same DIY site, no ad pixel. Discovery fit score 15 (pre-screen — not a Paydirt Fit Score). Site: villagerealestatemi.com/estate-sales Source: TKBS-Creative-Pipeline prospect spine (village-estate-sales), stage "researched".'),
  ('Village Real Estate Group', 'new', 'real estate (residential sales)', null, 'Independent owner-operated agent (David Greig) on a DIY GoDaddy site with no ad pixel: weak web + not advertising = double gap. Demand unconfirmed (0 Google reviews) - verify activity. Discovery fit score 15 (pre-screen — not a Paydirt Fit Score). Site: villagerealestatemi.com Source: TKBS-Creative-Pipeline prospect spine (village-real-estate-group), stage "researched".');

commit;
