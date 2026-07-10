# 99 — Sources & Discrepancies

## Where this knowledge base came from

Synthesized 2026-05-15 from two local sources on Joe's machine, mined by three
parallel research passes:

1. **`C:\TKBS-Obsidian-Files`** — the TKBS Obsidian vault. Covered:
   - `TKBS - Internal\` — Brand Guidelines, Design System, Animation Playbook,
     Web Design Playbook + Web Design Patterns, Marketing Strategy (Conversion
     Framework, Pricing Architecture, Content Strategy), Playbooks (Kickstarter
     suite, Dashboard Build, Micro May), Client Projects (Geek Mystique, Astro
     Paws), Tools (Higgsfield, MCP, AI image gen), and the CRM Build Playbook.
   - `TKBS-Custom-Apps\` — Seasonal Stylist (strategy/design/release/legal),
     Catalog Calibrator, Video Production pipeline, the 7 Shopify skills,
     Conventions (Brand, Repo-Overview).
2. **`C:\CRM`** — the Client-Acquisition repo: production `crm/` (Next.js +
   Supabase), legacy Python lead-gen CLI, the Express/SQLite prototype, the
   Paydirt engine, and `docs/plans` + `docs/specs`.

~90+ Markdown files plus the CRM's business-logic source were read. No source
files were modified.

## Discrepancies to resolve with the owner

These are recorded, **not silently reconciled**. Confirm before relying on them.

### 1. Company name

"Turnkey Business Solutions" (brand/marketing docs, Higgsfield workspace),
"Turnkey Marketing" (user's framing, `turnkeymarketing.com`), and "TKBS
Marketing" all refer to the same company. → **What is the canonical public name?**

### 2. Boost / Orbit monthly pricing

- Pricing Architecture doc: **Boost $2,500+/mo**, Orbit custom.
- Conventions / product-funnel ROI math: **Boost ≈ $500/mo, Orbit ≈ $2,000/mo**.

These differ by 5×. The product-venture ROI claims ("one Boost ≈ 10 months of
app MRR") depend on which is true. → **Which figures are current?**

### 3. ICP revenue band & geography

- Brand/marketing: family-owned small businesses, **$100K–$5M**, USA nationwide.
- CRM Fit-Score config: **$500K–$10M**, Michigan-primary, no international.

The operational system (CRM, scrapers, Paydirt) is effectively **Michigan-first
Metro Detroit**, despite the "nationwide" brand language. → **Is national a real
target or aspirational?**

### 4. Ownership vs partnership framing

One brand doc states TKBS is *"Josh Horsley's marketing + web agency."* The user
("Joe") frames it as **"our company TKBS"** — a partnership between Joe and Josh.
The CRM seeds both as equal `admin`s. → **What is the actual ownership/equity
structure, and how should the company be described publicly?**

### 5. Identity in the harness

The session `userEmail` is `joshhorsley92@gmail.com` (the shared GitHub/account
identity; repos are under `joshhorsley92`), but the session is on **Joe's**
machine (`motor`, git `Joe Zolinski`) and the user self-identifies as Joe.
Treat the operator of this repo as **Joe** unless told otherwise.

### 6. Repos referenced but not mined here

`TKBS_CustomerDashboards` (the customer portal) and the live marketing-site
codebases (`turnkey-business-solutions/`, `tkbs-nextjs/`) are referenced
throughout but were **not** available as sources for this pass. The Dashboard in
particular is the origin of the Seasonal Stylist tool and the Boost/Orbit
tier-credit system — likely high-value for a follow-up if a fuller picture is
needed.

## Status of this knowledge base

This is a **starting point** — shared TKBS company context dropped into a repo by
the `workspaceinit` skill, before (or alongside) defining what this specific repo
is for. It is a point-in-time snapshot synthesized from the TKBS Obsidian vault
and the Client-Acquisition repo as they were on 2026-05-15. Several dated facts
(Seasonal Stylist launch status, JOSH-TODO items, pricing locks) will drift —
re-verify against the live sources when they matter. Re-run `/workspaceinit`'s
refresh step (or re-mine the sources) to update the canonical copy.
