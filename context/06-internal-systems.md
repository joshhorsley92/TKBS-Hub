# 06 — Internal Systems

These are the systems TKBS runs on itself: the sales CRM, the lead-scoring
model, the sales methodology, and the pitch-research engine.

## The Client-Acquisition CRM

TKBS's internal sales engine — the company applying its own marketing
methodology to itself, at scale. Repo: `joshhorsley92/Client-Acquisition`,
local `C:\CRM`. Three generations exist in the repo; the **current production
system is `crm/`** (Next.js + Supabase). Legacy: a Python CLI lead-gen pipeline
and an earlier Express/SQLite prototype.

### End-to-end flow

`scrape → enrich → score → outreach → discovery call → brand-profile extraction
→ proposal → close → hand off to the Customer Dashboard`

1. **Lead Discovery** (`/discovery`) — pulls candidate businesses from Google
   Places (Michigan-defaulted; placeholder "Detroit, MI or 48226").
2. **Enrichment** — fetches each candidate's site, detects weakness signals.
3. **Opportunity scoring** — *higher weakness = better prospect*, because each
   gap maps to a service TKBS sells.
4. Promote → **Client**; compute **Fit Score** (0–100).
5. **Discovery call** recorded → transcript → Claude extracts a structured
   **Brand Profile**.
6. **Engagement** created (the deal unit); Claude generates a Hormozi-method
   proposal.
7. **Closed Won** → Brand Profile handed to the TKBS Customer Dashboard to
   auto-generate the client's marketing kit.

### Fit Score (0–100) — `crm/services/fit-score.ts`

- **ICP match (40):** industry_match 15, revenue_in_range 10, geographic_fit 5,
  green-flag bonus cap +10, red-flag penalty cap −15. Michigan/"MI" = full 5;
  other US state = 3/5; non-US = 0. Revenue in range = full; within ±25% = half.
  Green flags: `product_with_weak_marketing` (+10), `scaling_beyond_local` (+5),
  `needs_basic_assets` (+5). Red flag: `unclear_everything_cheap` (−15).
- **Readiness signals (30):** no website +10, no social +8, basic site quality
  +6, no SEO +4, no paid ads +2.
- **Engagement (30):** activity count — 0–2 → 0, 3–5 → 10, 6–10 → 20, 11+ → 30.

### Opportunity scoring (raw candidates) — `lead-discovery/scoring.ts`

Weights: `no_website 30`, `website_unreachable 25`, `no_paid_ads 15`,
`no_social_media 15`, `poor_seo 15`, `outdated_website 10`, `low_google_rating
10`, `low_google_review_count 10`, `poor_accessibility 5`. Tiers: **≥60 hot,
≥30 warm, <30 cool**. Verbatim comment: *"Higher score = better TKBS prospect,
because each signal corresponds to a service TKBS can sell."*

### ICP config — `crm/app/api/settings/icp/route.ts`

Admin-editable, stored in `crm.integration_settings`. Defaults: industries
`retail/boutique/service/contractor/b2b`; excluded
`large_corporation/art_sector/raw_materials/legal/medical/healthcare/insurance/accounting`;
revenue `$500K–$10M`; `primary_region: Michigan` (bonus), `national_ok: true`,
`international_ok: false`; blended hourly rate `$100/hr`; scoring weights
`icp_match 40 / readiness_signals 30 / engagement 30` (must sum to 100).

### Brand Profile pipeline (the flagship "TKBS-on-itself" workflow)

Sales call → audio to Supabase Storage → transcript (manual paste in v1.0;
Whisper deferred) → `POST /extract-brand-profile` → **Claude Opus** synthesizes a
5-section profile: **Business Identity, Customer Avatar, Brand Personality,
Visual Identity, Brand Voice**. Every field carries a confidence score (0–1) and
a verbatim `source_quote` so Josh can verify without re-reading the transcript.
Reviewer approves (`review_status` gate) → three-way merge into
`clients.brand_profile` JSONB → `/engagements/[id]/generate` loads it → Claude
generates the proposal. **Website Scrub** runs the same extractor against a
prospect's homepage using cheaper Claude Sonnet to pre-fill fields.

### Sales methodology — Alex Hormozi (verbatim system)

`HORMOZI_PREAMBLE` governs every AI-generated artifact: Value Equation (Dream
Outcome / Perceived Likelihood / Time Delay / Effort), Grand Slam Offer, CLOSER
call framework (Clarify–Label–Overview–Sell–Explain–Reinforce), 5-email cold
sequences (observation → case study → value bomb → check-in → break-up). Rules:
"never discount, adjust scope," "never just checking in." Pipeline stages: Lead →
Outreach → Discovery Call → Proposal → Follow-Up → Closed Won (+ Closed Lost).

### Deployment & access posture

In-house only, served over a **Tailscale** private mesh (a shared prod server on
Joe's laptop behind `tailscale serve` HTTPS, auto-starting on Windows login —
note the recurring rogue `:3001` auto-launcher gotcha). Hardened with TOTP MFA,
audit log, rate limiting. The client-facing **Customer Dashboard stays public**.
As of 2026-04-18 the CRM and Dashboard are **fully decoupled** (no HTTP
integration) — future shared data flows through Supabase tables only.

Canonical reference deal across the docs: **"Wren & Ivy" boutique** (test user
`megan@wrenandivyboutique.com`), seeded to hit exactly **80/100** Fit Score as
the model ideal client. (Not a real client — see [08-clients.md](08-clients.md).)

## Paydirt — pitch-research engine

Standalone pre-pitch research tool (`paydirt/` in the Client-Acquisition repo;
also exposed as the `/paydirt` skill in this environment). Given a target
URL/name it runs ~19–20 parallel data sources (site scrape, Lighthouse, Wayback,
WHOIS, tech stack, Google Places, BBB, Trustpilot/Yelp, Meta Ads, Reddit,
Instagram, TikTok, Glassdoor, Indeed, plus industry-gated directories Angi,
HomeAdvisor, Yellow Pages, Manta — legal/medical/insurance deliberately omitted
"per TKBS ICP"), then synthesizes pain points + ad copy + visual brief + pitch
summary via **Claude Haiku 4.5** (cached "Bedrock skill" prompts from the
Obsidian vault). Writes Markdown to **Joe's Google Drive**, Slack-notifies. Runs
on a long-running worker (Mac Mini); state in Supabase `crm.paydirt_runs`.

## CRM tech stack (brief)

TypeScript · Next.js (App Router, API routes → Netlify Functions) · Supabase
Postgres (`crm` schema, RLS, 10 migrations) · Supabase Auth (admin/member roles,
TOTP MFA, audit log) · Anthropic Claude via `@anthropic-ai/sdk` with prompt
caching — `claude-opus-4-6` (transcript extraction), `claude-sonnet-4-6`
(website scrub), Claude Haiku 4.5 (Paydirt) · Google Places API v1 · cheerio.
