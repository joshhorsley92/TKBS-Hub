# 08 — Clients & Partners

Named clients/partners found in the sources. Some are active engagements, one is
a launch partner, and one is a fictional reference deal — labeled accordingly.

> **The four below the fold were missing until 2026-07-13.** This file — and the
> Creative Pipeline's `dashboard/clients.json` — only ever knew Geek Mystique,
> Astro Paws, Foundations and Clothing Cove, because those are the clients that
> pass through the *Creative Pipeline*. The rest of TKBS's delivered work lives in
> repos nobody wrote down: Honest Mortgage, Sunsy, RMD and Champion Gasket were
> all reconstructed from commit history. That gap had teeth — the Hub's time
> tracker asks Claude "which client was this session for?" and offers this list to
> choose from, so **158 of 166 tracked hours came back unattributed**: the clients
> the work was *for* weren't on the list. Add new clients here when you win them.

## Honest Mortgage — active (website build, Jul 2026)

- **Business:** mortgage brokerage. Domain and contact are **not recorded in any
  repo** — ask Josh.
- **Engagement:** full website build — adaptive apply funnel, live rate board with
  a compliance reframe, refinance calculator, partner/careers pages, reviews
  carousel, and a site-wide "de-AI" copy pass.
- **Evidence:** repo `Honest-Mortgage-Website` (+ a second, `Honest-Mortgage`).
  **44 commits by Josh, 2026-07-02 → 2026-07-11** — by commit volume, the most
  active client engagement TKBS currently has.

## Sunsy (Derek Antosiek) — active (paid engagement)

- **Client:** **Derek Antosiek** — blog *Optimize Your Biology*
  (optimizeyourbiology.com), co-founder of **Sunsy** (sunsy.co, circadian
  lighting).
- **Engagement:** a content pipeline that turns a product into a near-publishable
  review in Derek's voice and exact template, plus Klaviyo welcome flows.
- **Evidence:** `Sunsy-Content-Pipeline/CLAUDE.md` calls it *"a paid TKBS client
  engagement"*. Repos: `Sunsy-Content-Pipeline` (21 commits),
  `Sunsy-Klaviyo-Welcome-Flows` (2, Josh).
- **Confirm:** that repo's ROADMAP frames the current phase as *"a sales demo to
  win Derek's agreement,"* with production work deferred *"only after Derek signs
  off."* So *something* is paid for, but the scope needs pinning down.

## RMD Jewelry — active (Klaviyo + SEO/AEO)

- **Business:** handcrafted jewelry e-commerce (rmdjewelry.com; "Rachel Marie
  Designs"). Also **stocked by Clothing Cove**, which is plausibly how the
  relationship came about.
- **Engagement:** Klaviyo integration (repo `RMD-Klaviyo-Integration`, Josh,
  2026-07-01) and a full ecommerce SEO/AEO audit.

## Champion Gasket & Rubber — stage unconfirmed (website shipped Apr 2026)

- **Business:** ISO 9001:2015-certified custom die-cut manufacturer (gaskets,
  seals, shims, pads) in **Walled Lake, MI**. 248-624-6140. Founded 1970.
- **Engagement:** a complete multi-page site (about, quality, products,
  industries, request-a-quote), built and hosted in `Web-Hosting/champion-gasket`,
  committed by **Josh on 2026-04-20**.
- **Confirm:** the site is the *only* record — no note, no roster entry, no CRM
  row. Nothing on file says whether the engagement is ongoing or finished.

## Grady's Garden — inbound lead (visibility done, ads staged)

- **Business:** garden center, Howell MI (gradysgarden.com,
  info@gradysgarden.com).
- **Engagement:** visibility audit complete (SEO 75.8 / AEO 62.7 / GEO 55.4 —
  branded-strong but category-invisible); a 2×2 A/B ad plan (4 ads) is staged,
  renders pending.
- **Why it matters:** *"Flipped cold → inbound client lead (2026-06-26)"* — TKBS's
  one genuine cold-outreach-to-client conversion, and therefore the proof the
  Creative Pipeline works end to end.

## Geek Mystique — active (planning/pricing phase, Apr 2026)

- **Client:** Thomas Covert, **Board Game Revolution (BGR)**, Michigan.
- **Brand:** "Geek Mystique." Tagline: *"Inspired by artists. Brought to life by
  fans."*
- **Business:** officially-licensed geek/IP art as premium prints, apparel,
  accessories — **Shopify + print-on-demand via Printful**. Likely starting IP:
  **Everdell**.
- **Assets:** ~30K email list (goal 50K), ~500 publisher relationships, active
  Facebook group.
- **Timeline:** demo site Fall 2026 → crowdfunding Jan–Feb 2027 → launch after.
- **Design direction:** dark/immersive, per-IP themed pages, ripple/wave
  dividers, lifestyle mockups (Dice Throne shop is the "gold standard"
  reference; dislikes plain white pages). This client's discovery note is the
  canonical TKBS 8-section discovery template.

## Astro Paws — active (Kickstarter pre-launch)

- **Client:** **Maka Games**.
- **Product:** "Astro Paws," a space-themed strategic card game (2–4 players,
  ages 8+, ~15 min). Tagline: *"The galaxy is vast… and your pets are loose."*
  Ad tagline: *"The Cutest Card Game in Space."*
- **Engagement:** Kickstarter pre-launch for **Micro May 2026**; Facebook +
  Instagram ads via Meta Ads Manager. Status: ad creatives generated (4 rounds,
  Higgsfield Marketing Studio, 5 characters), awaiting client review. CTA bar:
  Kickstarter green `#05ce78`, "Coming to Kickstarter | #MicroMay". Asset repo
  `MarketingAssetDevelopment/AstroPaws/`; a table of uploaded Higgsfield media
  IDs is preserved so assets needn't be re-uploaded.

## Foundations Tree Experts — active (Video Production pilot)

- **Business:** tree service (foundationstreeexperts.com, 734-474-3336). Has
  strong real job-site footage (chainsaws, climbers, crane lifts, before/after
  lots) but runs poor-quality FB ads.
- **Engagement:** the motivating client for the Video Production pipeline (Lane A
  — asset-first compositing). TKBS explicitly rejects generic AI-video for
  real-trade clients as "uncanny *and* dishonest advertising." Example concept:
  "26 Years. Zero Shingles."
- Also the source of the **`foundations-tree-expertsv3/`** static-React reference
  web build.

## Clothing Cove — launch partner (Seasonal Stylist)

- Committed launch partner for the Seasonal Stylist app — "pull, not push" (CC is
  actively asking for it). A multi-million-dollar/year store with
  **brick-and-mortar + in-store styling staff**. Real **3,600+ product** catalog
  is the demo/test fixture (already surfaced/fixed a v1.1 bug). One of 5 pilot
  merchants for listing-day reviews; co-marketing/case-study agreement pending
  Josh + CC sign-off. CC is walk-in only (no booked consults). See
  [05-product-ventures.md](05-product-ventures.md).

## Wren & Ivy — NOT a real client (canonical demo deal)

A seeded reference deal used across the CRM docs and the seed script (test user
`megan@wrenandivyboutique.com`), tuned to land at exactly **80/100** Fit Score as
the model "ideal client" for demos and testing. Do not treat as a real account.

## External benchmarks (not clients)

Kickstarter case studies cited for benchmarking only: Botany ($105K/24h), Alpha
Clash ($481K), Exploding Kittens ($8.7M).
