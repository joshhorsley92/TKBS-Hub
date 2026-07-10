# 02 — Brand & Design System

Values below are preserved **verbatim** from the TKBS brand guidelines, design
system, and animation playbook. They are shared across all three TKBS web
codebases (Astro static site `turnkey-business-solutions/`, Next.js site
`tkbs-nextjs/`, and the static React reference build `foundations-tree-expertsv3/`).

## Brand voice

- **Confident, not arrogant.** Direct and clear. No jargon or corporate-speak.
  Results-focused. Partnership "we" language.
- **Do:** "Build your marketing system," "See if we're the right fit," "Real
  results for real businesses."
- **Don't:** "Leverage synergistic solutions," "Schedule a demo today!,"
  "Revolutionary AI-powered platform," "Exclusive, premium, luxury."
- **Hard rule:** never fabricate data or numbers. Enforced in every session.

## Color palette

**Primary**

| Token | Hex | RGB | Use |
|---|---|---|---|
| Deep Charcoal | `#1B2838` | 27, 40, 56 | Primary backgrounds / text |
| Electric Mint | `#00D4AA` | 0, 212, 170 | Primary accent, CTAs, brand highlight |

**Extended**

| Token | Hex |
|---|---|
| Charcoal Light | `#2a3d52` |
| Charcoal Dark | `#0f1923` |
| Mint Dark (hover/active) | `#00B892` |
| Mint Light | `#33DDBB` |
| Cool Gray | `#64748B` |
| Gray Light | `#94A3B8` |
| Gray Dark | `#475569` |

**Surfaces**

| Token | Hex |
|---|---|
| Content background | `#F7F8FA` |
| Card background | `#FFFFFF` |
| Section border | `#E2E6EB` |
| Input border | `#CBD5E1` |
| Error | `#e53e3e` (ring `rgba(229,62,62,0.1)`) |

## Signature gradients & effects (verbatim)

- Hero / CTA gradient: `linear-gradient(135deg, #1B2838 0%, #0f1923 100%)`
- Hero ambient mint glow:
  `radial-gradient(ellipse at 70% 50%, rgba(0, 212, 170, 0.08) 0%, transparent 60%)`
- Mint button hover: darken to `#00B892` + `translateY(-1px)` +
  `box-shadow: 0 4px 12px rgba(0,212,170,0.3)`
- Focus ring: `0 0 0 3px rgba(0,212,170,0.15)`
- Card hover: `box-shadow: 0 8px 30px rgba(27,40,56,0.1)` + `translateY(-4px)`

## Typography

- **Display:** Outfit — weights 400/500/600/700, `--font-display`.
- **Body:** DM Sans — weights 400/500/700, `--font-body`. DM Sans is the
  agency-standard body font across every project.

Type scale:

| Element | Size / weight |
|---|---|
| Hero h1 | 3.5rem / 700 |
| Page h1 | 3rem / 700 |
| h2 | 2.25rem / 600 |
| h3 | 1.5rem / 500 |
| Body | 1rem / line-height 1.6 |
| Section label | 0.8125rem / 600, uppercase, 0.1em tracking, in mint |

Max body text width ≈ 700px.

## Design tokens

- Section padding: `--section-pad: 6rem 0`
- Container: `--container-width: 1200px` (1320px above 1440px viewport)
- Radii: 6px (sm) / 10px (md) / 16px (lg)
- Shadows: `--shadow-sm/md/lg` using `rgba(27,40,56,…)`
- Transition: `0.25s ease`

## Motion / animation

- **Standard easing (all codebases):** `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out).
  Framer Motion: `ease: [0.16, 1, 0.3, 1]`.
- **Default entrance:** Fade Up — opacity 0→1, translateY 24px→0, ~0.7s.

## Page architecture (the conversion framework)

Every page follows: **Problem → System → Solution → Trust → CTA.**

- CTA copy is first-person with a value verb: "Book Your Free Call," "Get My Free
  Playbook," "See If We're the Right Fit." Avoid "Submit / Send / Click / Buy."
  First-person CTA microcopy is cited internally as a ~90% conversion lift.
- The discovery-call page deliberately uses a "Not For Everyone" selectivity
  filter to raise conversion among good-fit prospects.
