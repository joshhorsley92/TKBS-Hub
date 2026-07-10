# joshhorsley92/TKBS-Hub — Project Context

This repository was initialized with `/workspaceinit`. The `context/` directory
holds the shared, canonical knowledge base about **TKBS** (the company), **Josh
Horsley** (owner), and **Joe Zolinski** (engineering lead) — read it before
doing anything substantive so you operate with full company context.

> **Project-specific scope:** Internal hub / dashboard for TKBS operations (scope still being defined).

## Who & what (one-paragraph version)

**TKBS** — "Turnkey Marketing" / legally **Turnkey Business Solutions**, a Michigan
LLC — is a deliberately small, two-person marketing + web agency. Its thesis:
**"We don't sell services. We build systems."** It builds complete, connected
marketing systems (traffic → capture → nurture → convert) for family-owned small
businesses, and it productizes its proven internal tools into standalone
software. **Josh Horsley** owns it (sales, client relationships, decisions,
legal/billing, brand voice); **Joe Zolinski** is the engineering lead (specs,
code, infrastructure, AI pipelines). Joe builds and proposes; Josh decides and
authorizes.

> The operator of this repo is **Joe** (machine `C:\Users\motor`, git
> `Joe Zolinski`). The shared GitHub/account identity is `joshhorsley92` — that
> is not a contradiction. See [context/01-people.md](context/01-people.md).

## Knowledge base index

| File | What's in it |
|---|---|
| [context/00-company-overview.md](context/00-company-overview.md) | TKBS identity, positioning, mission, ICP, the repo/product ecosystem |
| [context/01-people.md](context/01-people.md) | Joe & Josh — roles, machines/accounts, how they work together |
| [context/02-brand-and-design-system.md](context/02-brand-and-design-system.md) | Brand voice + verbatim design tokens (colors, type, motion) |
| [context/03-pricing-and-offers.md](context/03-pricing-and-offers.md) | Agency tiers, the Lead Guarantee, product pricing |
| [context/04-services-and-playbooks.md](context/04-services-and-playbooks.md) | Web design, Kickstarter, dashboards, content, discovery method |
| [context/05-product-ventures.md](context/05-product-ventures.md) | Seasonal Stylist, Catalog Calibrator, Video Production pipeline |
| [context/06-internal-systems.md](context/06-internal-systems.md) | The CRM (Client-Acquisition), Paydirt, ICP & Fit Score, Hormozi method |
| [context/07-tools-and-stack.md](context/07-tools-and-stack.md) | Higgsfield, Claude, MCP, tech stacks, hosting |
| [context/08-clients.md](context/08-clients.md) | Named clients/partners and the canonical demo deal |
| [context/99-sources-and-discrepancies.md](context/99-sources-and-discrepancies.md) | Provenance + conflicts to confirm with the owner |

## Working norms (how TKBS operates)

- **Never fabricate data or numbers.** A hard "Josh rule," enforced in every
  session. If a figure isn't sourced, say so.
- **Factual over enthusiastic.** State what needs deciding; don't hype.
- **Scope discipline.** Ship the smallest thing that proves the case.

## Slack commit notifications

This repo has the TKBS commit-notifier hook installed (`.claude/settings.json`
→ `.claude/hooks/notify-slack.sh`). A `git commit` made **through Claude Code**
posts the commit hash + subject + GitHub link to Slack so Josh sees what shipped.
It is inert until `SLACK_WEBHOOK_URL` is set in `.claude/settings.local.json`
(gitignored). Same setup as the CRM / Custom-Apps repos.
