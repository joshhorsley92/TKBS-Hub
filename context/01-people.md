# 01 — People: Joe & Josh

TKBS is a two-person company. The division of labor is clean and consistently
documented across both source vaults: **Joe builds and proposes; Josh decides,
authorizes, and owns the money / legal / client side.**

## Josh Horsley — Owner / Founder

- **Email:** `josh@tkbsmarketing.com`; personal/account `joshhorsley92@gmail.com`.
- **GitHub:** `joshhorsley92` (owns the `TKBS-Custom-Apps`,
  `Client-Acquisition`, and `TKBS_CustomerDashboards` repos).
- **Machine:** Windows user `joshh`; owns the Obsidian vault
  (`C:\Users\joshh\Documents\Obsidian Vault`) — he is the author of the
  brand/marketing/web-design knowledge base.
- **Role:** owner and operator. Sales and discovery calls, client relationships,
  brand voice, and **all decisions, sign-offs, accounts, billing, and legal**.
  The CRM exists explicitly "to tell Josh which prospects are worth pursuing and
  where to spend his time."
- **Only Josh can:** open paid accounts (Vercel Pro, Anthropic billing), own the
  Shopify Partners org + accept app transfers, engage an attorney, provide the
  TKBS mailing address, broker partner conversations (e.g. Clothing Cove), and
  give pricing sign-off.
- **Incident response:** "Josh (TKBS owner) on-call." Reviews every App Store
  review within 24h.
- **Working style:** *"Factual over enthusiastic. Tell Josh what needs deciding;
  don't hype."* Enforces the **no-fabricated-data** rule.
- **How he's kept in the loop:** a single-source-of-truth `JOSH-TODO.md` tracker
  (Joe adds blockers, Josh checks them off), Slack notifications on every git
  commit, and explicit **"TL;DR for Josh"** sections written into strategy docs.
- Appears as the archetype persona in product specs ("Josh / the store owner" —
  the merchant admin who sets things up once, then reviews results).

## Joe Zolinski — Engineering Lead / Builder

- **Email:** `joe@tkbsmarketing.com`; CRM role `admin`.
- **Machine:** Windows user `motor` (`C:\Users\motor`); git author
  `Joe Zolinski`. The Client-Acquisition / custom-apps work happens here. **This
  Claude Code session is running on Joe's machine.**
- **Role:** engineering lead. Drafts every spec, builds all the code, runs
  infrastructure and deployments, owns the Tailscale deployment host
  (`mcm-pc2.tail87b28f.ts.net`), owns the Google Drive that Paydirt writes to,
  and maintains the `JOSH-TODO.md` tracker.
- **What Joe drives:** scaffolds/builds the Shopify apps, drafts
  strategy/legal/spec docs (with Claude), produces demo videos, coordinates
  clients on the technical side, runs the deployment execution, and sets product
  direction within engineering ("Joe's recommendation" is the engineering POV
  Josh decides on; e.g. Joe slashed Catalog Calibrator pricing and killed its
  $799 ceiling).
- **Incident response:** "Joe (engineering lead) triages and contains."

## How they work together

- **Build → Decide loop.** Joe proposes (specs, "Joe's recommendation"); Josh
  pushes back / signals direction in discussion; the decision is then formally
  locked. Example: Seasonal Stylist pricing was reframed to $0/$49/$199 after
  Josh pushback.
- **Three coordination channels:**
  1. `JOSH-TODO.md` — the canonical list of every decision/sign-off/account/
     payment Josh needs to handle. Auto-maintained by Joe.
  2. **Slack** — every commit in `TKBS-Custom-Apps` and the CRM posts to Slack
     ("new commit by Joe Zolinski"); commit messages are written assuming Josh
     reads them there. UI work is deliberately batched into larger commits so
     Josh sees coherent "here's what shipped" updates, not fragment pings.
  3. **"TL;DR for Josh"** sections embedded in strategy/competitor/handoff docs.
- Both are the only two people with production access. Default seeded CRM logins
  are `joe@tkbsmarketing.com` / `josh@tkbsmarketing.com` (password `changeme`,
  changed on first login).

## Identity reconciliation (important)

The user in this session refers to himself as **Joe** and to **Josh** as his
business partner ("our company TKBS"). The sources are consistent with this:

- This machine is Joe's (`motor`, git `Joe Zolinski`).
- The harness `userEmail` is `joshhorsley92@gmail.com` because the GitHub org and
  shared accounts are under Josh's identity — not because the user is Josh.
- One brand doc phrases TKBS as "Josh Horsley's marketing + web agency." The user
  frames it as a partnership between the two of them. This ownership-vs-partnership
  nuance is **not resolved here** — flagged in
  [99-sources-and-discrepancies.md](99-sources-and-discrepancies.md) for the owner
  to clarify.
