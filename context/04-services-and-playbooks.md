# 04 — Services & Playbooks

These are the actual methodologies TKBS uses to deliver work. They're codified in
the Obsidian vault and reused across clients.

## Web design

Two-stack decision model, both deploying to **Netlify** (forms via Netlify Forms):

- **Stack A** — static React / CDN. Reference build `foundations-tree-expertsv3/`.
  Used for local service businesses, single-purpose sites.
- **Stack B** — Next.js + Tailwind + Framer Motion + MDX. Reference build
  `tkbs-nextjs/`. Used for multi-page / SEO / CMS-driven sites.

Supporting playbooks in the vault: Mobile Optimization, Launch Checklist, Hero
Video Pipeline (ffmpeg dual-crop: desktop 16:9 + mobile 3:4), Performance
Patterns (Core Web Vitals targets LCP < 2.5s / INP < 200ms / CLS < 0.1; documents
the Next.js 16 Turbopack PostCSS zombie-process bug + `--webpack` workaround),
SEO & AEO checklist (JSON-LD schema gotchas, sr-only H1 keyword technique),
Typography, Color/Visual Effects, UX/Conversion patterns. Per-project
lessons-learned logs are maintained.

## Kickstarter campaign services

A major service line. Core thesis: **pre-launch matters more than the campaign** —
day-1 momentum triggers Kickstarter's algorithm.

- **VIP Deposit Model** (LaunchBoom method): Ad → landing page (email capture) →
  thank-you page offers a **$1 refundable VIP deposit**. VIP list converts at
  **20–40%** vs **2–5%** email-only. Goal pre-launch: 1,000+ emails or 200+ VIP
  deposits. Detailed 12/8/4/1-week pre-launch timeline + email sequences.
- **3-Layer ad targeting:** platform familiarity (Kickstarter/crowdfunding) +
  category interest (e.g. board/card games) + thematic match.
- **Benchmarks:** cost/email-lead < $2 · CPC < $0.20 · CTR > 2% · backer
  acquisition $15–50 · ROAS > 2.5× · VIP deposit conversion 20–40%. Explicit
  kill/scale rules; Meta Ads Manager prospecting + retargeting structure; ad-copy
  formulas ranked by ROAS (Introduction Formula best). External benchmarks cited:
  Botany ($105K/24h), Alpha Clash ($481K), Exploding Kittens ($8.7M).
- **Micro May:** Kickstarter's official Open Call every May for microgames; **84%
  of Micro May projects fund** (used as a trust signal). Badge colors: gold
  `#f5c518`, Kickstarter green `#05ce78`. Hashtags `#MicroMay #MicroGameMay`.

## Dashboard builds

Reusable patterns from TKBS Customer Dashboards: a **Next.js + Supabase
multi-tenant B2B dashboard** with provider integrations.

- Common `lib/integrations/` interface (`testConnection()` / `fullSync()`).
- AES-256-GCM credential encryption (`iv:authTag:ciphertext`).
- SQL `tier_rank()` hierarchy: **prospect → spark → launch → boost → orbit**.
- Three-layer tool-access gating; two-part credit system (monthly tier credits +
  permanent purchased credits).
- Cron resilience: `Promise.allSettled`, `CRON_SECRET`, `sync_logs`.
- Documented integration gotchas: Klaviyo (1-yr query limit, inflated unique
  counts), Shopify (`order=created_at+asc` pagination), Meta Ads (no incremental
  sync; Ad Library API needs separate enrollment).

## Content / lead-gen funnel

- **Marketing System Quiz** — 10 questions, 4 options each scored 0–3 (0–30
  range), 10 categories (avatar, lead magnet, email, landing page, welcome
  sequence, ads, tracking, website, traffic, system integration), email-gated
  results.
- **Lead magnets:** Retail Marketing Playbook (5-section PDF), Ad System Audit
  Checklist.
- **Email:** Mailchimp (Klaviyo for e-commerce clients), 80/20 value/promo, 3–5
  email welcome sequence.
- **Blog formula:** Hook → problem diagnosis (systems framing) → simple
  framework → takeaways → bridge to TKBS → CTA. Author/publisher: Josh Horsley /
  Turnkey Business Solutions.

## Client discovery methodology

The canonical TKBS discovery template (originating from the Geek Mystique
discovery note) has **8 sections**, reused for every new client:

1. Brand Identity
2. Visual Aesthetic
3. Product / Service Strategy
4. Site Architecture
5. Business Context
6. Competitive Positioning
7. Working Style
8. Open Questions

This same Brand Profile concept is shared infrastructure: the CRM extracts it
from discovery-call transcripts via Claude, and the Video Production pipeline
consumes it. See [06-internal-systems.md](06-internal-systems.md).
