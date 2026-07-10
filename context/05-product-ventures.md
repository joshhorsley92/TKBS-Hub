# 05 — Product Ventures

TKBS productizes its proven internal tools. Three ventures are in flight; all are
dual-purpose (standalone revenue **and** a funnel into Boost/Orbit retainers).
Pricing details live in [03-pricing-and-offers.md](03-pricing-and-offers.md).

## Seasonal Stylist (Shopify app — near launch)

**One-sentence pitch:** *"AI color analysis that turns a customer's selfie into a
12-season palette AND a list of products from your store they can add to cart."*

An extraction of a production Personal Color Analysis tool that already lives
inside the TKBS Customer Dashboard. Working name "TKBS Seasonal Stylist" (locked
2026-04-21; Joe may revisit before submission). Defensible positioning claim:
*"the only 12-season personal color analysis app on the Shopify App Store"* (as
of 2026-04-24 — confirmed whitespace; competitors hide the 12-season vocabulary).

**Status:** v1 (Color Analysis) and v1.1 (Wardrobe Capsule Creator) shipped /
code-complete. v1.2 (Cart Optimizer) code-complete (146/146 tests passing),
awaiting dev-store QA. **Not yet submitted** — blocked only on Josh-owned launch
ops (hosting accounts, legal pages, Partners-org transfer, Level 1 application,
demo video). "All code-side submission blockers are complete."

**Roadmap:** v1 Color Analysis → v1.1 Wardrobe Capsule → v1.2 Cart Optimizer →
v1.3 In-store Mode (staff tablet/PWA, Pro anchor) → v1.4 Consultation Booking +
Catalog Calibration. Strict sequence rule. Scope discipline: OAuth scopes in
`shopify.app.toml` must match actual code usage (over-scoping is a Level 1
rejection flag; trimmed to `read_products`, `read_customers`).

**Technical moat already owned:** 12-season system via Claude Vision; multi-photo
cross-analysis; Delta-E CIE2000 matching in LAB space (pure math, zero deps); a
**325-entry** retail color-name → hex map (`COLOR_NAME_MAP`, drift-guarded by
test); LAB-space modifier parsing ("dusty navy"); ~50% framework-agnostic code
already extracted to `core/`. Adaptive-branding thesis: the app renders in *the
merchant's* identity, not TKBS's.

**Stack:** Remix + Shopify Polaris/App Bridge + App Proxy + Prisma/PostgreSQL +
Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) + Shopify Billing API,
deployed on **Vercel** (reusing the TKBS Supabase Postgres via pooler). **Photos
are never stored** — streamed to Claude as base64 and discarded (enforced by
code review + integration test). Repo `joshhorsley92/TKBS-Custom-Apps`, root
`apps/public/shopify-seasonal-colors/remix-app`.

**Launch partner — Clothing Cove (CC):** committed, "pull not push." A
multi-million-dollar/year store with **brick-and-mortar + in-store styling
staff** — a B2B use case no pure-online competitor addresses. Real **3,600+
product** catalog used as the test fixture (already surfaced/fixed a v1.1 bug).
One of 5 pilot merchants for listing-day reviews. CC is walk-in only, which is
why v1.4 Booking is not a launch prerequisite.

**Competitive set:** Tangent (selfie skin → skincare; standard-bearer but an
*adjacent* vertical, not a direct competitor), misi (apparel quiz, beatable),
StyleSync (unverified review count, flagged for teardown). Strategic optionality
(acquisition/partnership with Tangent) is explicitly held as "a possibility, not
a plan" — do not design the product for an acquirer.

## Catalog Calibrator (spun-out Shopify app)

A second standalone app, spun out 2026-05-01 from Seasonal Stylist's v1.4 Catalog
Calibration feature. One-time, merchant-paid AI catalog photo/listing auditor
(Claude Vision). Broader audience than Seasonal Stylist; shared engine. Currently
folder scaffold only (README + STRATEGY, no code) — the engine ships *inside*
Seasonal Stylist v1.4 first, then spins out once first-merchant data validates
the pitch. Joe owns the spinoff-timing call.

## Video Production pipeline (operated service)

A new TKBS service line, productionized 2026-05-01: short-form FB/IG video ad
production for **existing** clients, billed as a monthly retainer (~1 video/wk).
Internal TKBS-operated — clients receive deliverables, never operate the
pipeline. Lives in a top-level `services/` lane. Motivating client:
**Foundations Tree Experts** (see [08-clients.md](08-clients.md)).

**Two lanes, one engine (Remotion):**

- **Lane A — Asset-First Compositing** (default): real footage is the spine, AI
  fills B-roll gaps. (Foundations → Lane A.)
- **Lane B — Generative-First with Real Anchors**: thin/no real footage,
  generative video is the spine. Recommended pilot: a Seasonal Stylist demo ad
  (TKBS owns it; doubles as App Store marketing).

**8-stage pipeline:** Discovery & Intake → Treatment (client signoff before any
rendering) → Asset Prep → EDL Generation (Claude → JSON) → Generative Fill
(Claude → Higgsfield via MCP) → Voiceover (optional, ElevenLabs) → Composition
Spec → Remotion (the leverage point: Claude generates an editable JSON timeline;
a compiler translates spec → Remotion JSX; iteration happens at spec level) →
Packet Delivery (9:16 / 1:1 / 16:9 MP4s + .srt captions + thumbnails + ad copy,
via Frame.io).

The **TKBS CRM is the canonical source** for each client's `brand-profile.json`
(maps from `clients.brand_profile` JSONB). Tooling locked: Remotion, Higgsfield
(existing TKBS Ultimate account), ElevenLabs (VO), Epidemic Sound (music), Topaz
Photo AI (upscale), Frame.io (review). Approach: "Build the Video First,
Framework Second" — Pilot 1 time-boxed to ~1 week.

## Why this matters strategically

App MRR alone is modest by design. The repeated strategic statement: the **real
ROI is the funnel-to-services multiplier** — products generate leads into the
higher-margin Boost / Orbit retainers. 12-month kill criterion: if < 5 funnel
conversions by month 12, reposition the app as a standalone product.
