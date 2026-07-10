# 00 — Company Overview: TKBS

## Identity

- **Brand / colloquial name:** TKBS, "Turnkey Marketing."
- **Legal / formal name:** Turnkey Business Solutions (the Obsidian brand docs use
  this consistently; "TKBS Marketing" also appears). Michigan LLC.
- **Tagline:** *"Your Growth, Unlocked."*
- **Wordmark:** `TURNKEY` — "TURN" in white/charcoal, "KEY" in Electric Mint.
- **Domains:**
  - `tkbsmarketing.com` — email domain (`joe@tkbsmarketing.com`,
    `josh@tkbsmarketing.com`, `support@tkbsmarketing.com`).
  - `turnkeymarketing.com` — public site; `dashboard.turnkeymarketing.com` is the
    client Customer Dashboard.
- **Team size:** Two people (Josh Horsley, Joe Zolinski). Deliberately small and
  selective — see [01-people.md](01-people.md).

> **Naming note:** "Turnkey Business Solutions," "Turnkey Marketing," and "TKBS
> Marketing" are all used for the same company across the sources. Treated as
> synonyms here; flagged in [99-sources-and-discrepancies.md](99-sources-and-discrepancies.md).

## The thesis

The single most-repeated positioning line, verbatim:

> **"We don't sell services. We build systems."** — also stated as *"Systems, not
> services."*

TKBS positions itself in the gap between **big agencies** (too expensive, ignore
small business) and **freelancers** (deliver isolated pieces, never the whole
picture). It builds the complete, connected marketing system instead:
**email → ads → landing pages → follow-up**, all wired together.

The customer-facing 4-part system model: **Traffic → Capture → Nurture → Convert.**

## Mission & values

- **Partnership Over Transactions** — long-term partner, not a vendor.
- **Selectivity Over Volume** — limited clients, deep attention. *"We choose
  clients we know we can help — because our reputation depends on your results."*
- **Systems Thinking** — every piece connects to every other piece.
- **Results Focus** — no vanity metrics.

## Ideal customer (ICP)

There are two ICP statements in the sources; both are recorded here. Reconcile
with the owner before treating either as authoritative — see
[99-sources-and-discrepancies.md](99-sources-and-discrepancies.md).

| Dimension | Brand/marketing docs | CRM Fit-Score config (operational) |
|---|---|---|
| Business type | Family-owned small businesses | `retail`, `boutique`, `service`, `contractor`, `b2b` |
| Excluded | — | `large_corporation`, `art_sector`, `raw_materials`, `legal`, `medical`, `healthcare`, `insurance`, `accounting` |
| Revenue | **$100K–$5M/yr** | **$500K–$10M/yr** |
| Geography | USA nationwide | Michigan-primary (bonus), national OK, **no international** |
| Founder profile | Has a real product/service, wants to grow, willing to invest, frustrated by past results | green flags: weak marketing on a good product, scaling beyond local, needs basic assets |

The CRM's lead-discovery default location is **Michigan** (placeholder "Detroit,
MI or 48226"); the legacy scrapers targeted **Wayne, Oakland, Macomb** (Metro
Detroit) counties. So the operational reality skews Michigan-first even though the
brand says "nationwide."

## The product/repo ecosystem

TKBS runs as a small product company, not just a service shop. Three primary
repos plus an operated-services lane:

1. **Client-Acquisition** (`joshhorsley92/Client-Acquisition`, local `C:\CRM`) —
   the internal sales engine: lead scraping → enrichment → Fit Score → outreach →
   discovery call → AI brand-profile extraction → proposal → close. Includes the
   legacy Python lead-gen CLI and the **Paydirt** pitch-research engine. See
   [06-internal-systems.md](06-internal-systems.md).
2. **TKBS_CustomerDashboards** — Next.js + Supabase multi-tenant customer portal
   with 10+ AI tools. Public apps are extractions of proven Dashboard tools.
3. **TKBS-Custom-Apps** (`joshhorsley92/TKBS-Custom-Apps`) — standalone apps
   (`apps/public/` marketplace SaaS, `apps/client/` bespoke client builds) and
   operated retainer services (`services/`, e.g. Video Production). See
   [05-product-ventures.md](05-product-ventures.md).

The strategic pattern, stated repeatedly: **products are funnels.** Standalone
app revenue is treated as "modest"; the real ROI is each product feeding leads
into the higher-margin Boost / Orbit retainers. One Boost conversion is worth
roughly 10 months of app MRR; one Orbit ≈ 40 months.

## Operating culture

- **Never fabricate data or numbers** — an explicit hard "Josh rule," enforced in
  every working session.
- **Factual over enthusiastic** — tell Josh what needs deciding; don't hype.
- **Scope discipline** — ship the smallest thing that proves the business case.
- **Async, documented, single-source-of-truth** — canonical docs, codified
  skills, a `JOSH-TODO.md` decision tracker, Slack-notified commits.
