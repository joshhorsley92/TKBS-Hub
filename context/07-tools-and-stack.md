# 07 — Tools & Stack

## AI media generation — Higgsfield AI (primary creative tool)

Multi-model platform (Sora 2, Veo 3.1, Kling 3.0, Seedance 2.0, etc.). Marketing
Studio is the key feature for TKBS ad work; Soul ID for character consistency;
image-to-video.

- **Critical operational fact — two separate billing surfaces:**
  - Consumer `higgsfield.ai` — TKBS **Ultimate** plan, account
    `support@tkbsmarketing.com`. The MCP server and the `hf` CLI bill **this**.
  - B2B `cloud.higgsfield.ai` — separate credit pool. The Python
    `higgsfield-client` SDK / `platform.higgsfield.ai` bill **Cloud**.
  - Default to the CLI. (Joe burned an evening on 404s chasing this distinction —
    documented 2026-05-12.)
- **CLI:** the official prebuilt `hf` binary. Do **not**
  `npm install -g @higgsfield/cli` (v0.1.40 Windows postinstall is broken). TKBS
  convention path: `~/.paydirt/higgsfield-cli/hf`.
- Common models: `gpt_image_2` (default for Paydirt, 4 cr/image), 
  `text2image_soul_v2` (cheap, 0.12 cr), `marketing_studio_image`,
  `nano_banana_2`, `soul_cinematic`, `flux_kontext`, `seedream_v5_lite`.

## Claude / Anthropic

- **Anthropic SDK** (`@anthropic-ai/sdk`) with prompt caching
  (`cache_control: ephemeral`) used everywhere. Models in active use:
  `claude-opus-4-6` (transcript brand-profile extraction),
  `claude-sonnet-4-6` (website scrub), `claude-sonnet-4-20250514` (Seasonal
  Stylist), Claude Haiku 4.5 (Paydirt synthesis).
- **Claude Code + Obsidian** is the cross-project knowledge base. Vault =
  `C:\Users\joshh\Documents\Obsidian Vault` (Josh's machine) /
  `C:\TKBS-Obsidian-Files` (the copy mined for this repo). Claude Code connects
  via the `obsidian-mcp` server (vault name `obsidian-vault`) or direct file
  writes; there's a documented protocol for writing lessons-learned, patterns,
  and client discovery notes back to the vault.

## MCP servers

Obsidian (local stdio, `obsidian-mcp`) · Higgsfield AI (remote http,
`https://mcp.higgsfield.ai/mcp`, OAuth) · Magic / 21st.dev (local, user-level,
component building) · plus Claude.ai built-ins (Gmail, Google Calendar, Google
Drive, Slack). Key gotcha: **VS Code only reads project-level `.mcp.json`**, not
`~/.claude/.mcp.json`.

## Web / app tech stacks

| Domain | Stack |
|---|---|
| Marketing sites | Astro static (`turnkey-business-solutions/`); Next.js + Tailwind + Framer Motion + MDX + shadcn/Radix (`tkbs-nextjs/`); static React/CDN (`foundations-tree-expertsv3/`) |
| Customer Dashboard | Next.js + Supabase, multi-tenant |
| CRM | Next.js (App Router) + Supabase Postgres + Supabase Auth, Netlify Functions |
| Shopify apps | Remix + Polaris/App Bridge + App Proxy + Prisma/PostgreSQL + Shopify Billing API, on Vercel |
| Video pipeline | Remotion (render engine), Higgsfield (generative), ElevenLabs (VO), Epidemic Sound (music), Topaz Photo AI (upscale), Frame.io (review) |

## Hosting & services

- **Netlify** — marketing sites + CRM (Functions; 10–26s timeout, drives
  two-phase job designs) + Netlify Forms.
- **Vercel** — Shopify apps (Josh-owned paid account).
- **Supabase** — Postgres + Auth + Storage; one project, `crm` schema isolated
  from the Dashboard's `public.*` tables.
- **Tailscale** — private mesh serving the in-house CRM.
- **Email:** Mailchimp (general), Klaviyo (e-commerce clients).
- **Ads / analytics:** Meta Ads Manager + Google Ads; GA4 + Meta Pixel
  (consent-gated).
- **Asset prep:** ffmpeg (hero video dual-crop), `rembg` (bg removal), `pypdf`
  (PDF asset extraction); Canva/Figma for compositing exact logos/text over
  AI-generated comps.

## Shopify engineering capability

Seven codified, auto-firing Claude Code skills cover the full App Store
lifecycle: app scaffold (Remix+TS+Prisma), OAuth/session, billing,
App Proxy, product sync, GDPR webhooks, Polaris admin — each gotcha-aware and
distilled from a 2026-04-20 research pass. This represents production-grade,
rejection-aware Shopify-app engineering, not first-attempt knowledge.
