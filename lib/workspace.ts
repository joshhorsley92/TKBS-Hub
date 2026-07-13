// Per-person workspaces. All DATA is shared between Joe and Josh — only the
// PRESENTATION is personal: accent, display font, density, sidebar order,
// landing page, focus filter, and which Pulse cards show in which order.
//
// Persisted to workspace_prefs.prefs (jsonb), keyed by profiles.id.

import type { PersonKey } from './broadsheet';

/* ── pages ───────────────────────────────────────────────────────────────── */

export type PageKey = 'pulse' | 'builds' | 'clients' | 'init' | 'time' | 'pipeline' | 'money';

export const ALL_PAGES: PageKey[] = ['pulse', 'init', 'pipeline', 'clients', 'builds', 'money', 'time'];

export const PAGE_LABEL: Record<PageKey, string> = {
  pulse: 'Pulse',
  init: 'Initiatives',
  pipeline: 'Pipeline',
  clients: 'Clients',
  builds: 'Builds',
  money: 'Money',
  time: 'Timeline',
};

export const PAGE_HREF: Record<PageKey, string> = {
  pulse: '/',
  init: '/initiatives',
  pipeline: '/pipeline',
  clients: '/clients',
  builds: '/builds',
  money: '/money',
  time: '/timeline',
};

/* ── pulse modules ───────────────────────────────────────────────────────── */

export type PulseKey = 'digest' | 'attention' | 'initiatives' | 'signals' | 'calendar' | 'projection';

export const ALL_PULSE: PulseKey[] = [
  'digest',
  'attention',
  'initiatives',
  'signals',
  'calendar',
  'projection',
];

export const PULSE_LABEL: Record<PulseKey, string> = {
  digest: 'Daily digest',
  attention: 'Needs deciding',
  initiatives: 'Active initiatives',
  signals: 'Live signals',
  calendar: '2-week look-ahead',
  projection: 'Money & projection',
};

/* ── theme ───────────────────────────────────────────────────────────────── */

export type Accent = '#00A183' | '#3B7BE0' | '#7C5CF0' | '#C77706';
export type DisplayFont = 'Outfit' | 'Space Grotesk' | 'Newsreader';
export type Density = 'compact' | 'regular' | 'comfy';

export const ACCENTS: Record<Accent, { name: string; ink: string; bright: string; dark: string; wash: string }> = {
  '#00A183': { name: 'Electric Mint', ink: '#00A183', bright: '#00D4AA', dark: '#00B892', wash: '#E8FAF5' },
  '#3B7BE0': { name: 'Cobalt', ink: '#2C63C4', bright: '#3B7BE0', dark: '#2C63C4', wash: '#EAF1FC' },
  '#7C5CF0': { name: 'Violet', ink: '#6746D6', bright: '#7C5CF0', dark: '#6746D6', wash: '#F0ECFD' },
  '#C77706': { name: 'Amber', ink: '#B36A05', bright: '#E08A0A', dark: '#B36A05', wash: '#FBF1E3' },
};

// Maps to the next/font CSS variables declared in app/layout.tsx.
export const FONT_VAR: Record<DisplayFont, string> = {
  Outfit: 'var(--font-outfit), system-ui, sans-serif',
  'Space Grotesk': 'var(--font-space-grotesk), system-ui, sans-serif',
  Newsreader: 'var(--font-newsreader), Georgia, serif',
};

export const DENSITY: Record<Density, { fs: string; wrap: string }> = {
  compact: { fs: '13px', wrap: '26px 36px 70px' },
  regular: { fs: '14px', wrap: '34px 44px 80px' },
  comfy: { fs: '15px', wrap: '40px 54px 90px' },
};

/* ── the profile ─────────────────────────────────────────────────────────── */

export type WorkspaceProfile = {
  theme: { accent: Accent; font: DisplayFont; density: Density };
  landing: PageKey;
  /** 'all' = everyone's work | 'me' = just this person's */
  ownerFilter: 'all' | 'me';
  nav: PageKey[];
  pulse: PulseKey[];
};

// Joe — engineering: long-form, repo-and-client-history heavy, sees everyone.
// Josh — owner: the highlights, money forward, focused on his own plate.
export const DEFAULT_PROFILES: Record<PersonKey, WorkspaceProfile> = {
  joe: {
    theme: { accent: '#00A183', font: 'Outfit', density: 'comfy' },
    landing: 'pulse',
    ownerFilter: 'all',
    nav: ['pulse', 'builds', 'clients', 'init', 'time', 'pipeline', 'money'],
    pulse: ['digest', 'signals', 'attention', 'initiatives', 'calendar', 'projection'],
  },
  josh: {
    theme: { accent: '#3B7BE0', font: 'Space Grotesk', density: 'compact' },
    landing: 'pulse',
    ownerFilter: 'me',
    nav: ['pulse', 'money', 'pipeline', 'clients', 'init', 'builds', 'time'],
    pulse: ['digest', 'projection', 'attention', 'calendar'],
  },
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/** Merge a persisted (possibly stale/partial) blob over the person's defaults. */
export function mergeProfile(saved: unknown, who: PersonKey): WorkspaceProfile {
  const def = DEFAULT_PROFILES[who];
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<WorkspaceProfile>;
  const p: WorkspaceProfile = { ...clone(def), ...s };

  p.theme = { ...def.theme, ...(s.theme ?? {}) };
  if (!ACCENTS[p.theme.accent]) p.theme.accent = def.theme.accent;
  if (!FONT_VAR[p.theme.font]) p.theme.font = def.theme.font;
  if (!DENSITY[p.theme.density]) p.theme.density = def.theme.density;

  p.nav = (Array.isArray(s.nav) ? s.nav : def.nav).filter((k) => ALL_PAGES.includes(k));
  if (!p.nav.length) p.nav = clone(def.nav);
  // Pulse is the home surface and can't be hidden — it's the only page
  // guaranteed to exist, so `landing` always has somewhere to land.
  if (!p.nav.includes('pulse')) p.nav.unshift('pulse');

  p.pulse = (Array.isArray(s.pulse) ? s.pulse : def.pulse).filter((k) => ALL_PULSE.includes(k));

  if (!ALL_PAGES.includes(p.landing) || !p.nav.includes(p.landing)) p.landing = 'pulse';
  if (p.ownerFilter !== 'all' && p.ownerFilter !== 'me') p.ownerFilter = def.ownerFilter;

  return p;
}

/** The CSS custom properties that carry a person's theme. */
export function themeVars(p: WorkspaceProfile): React.CSSProperties {
  const a = ACCENTS[p.theme.accent] ?? ACCENTS['#00A183'];
  return {
    '--mint': a.bright,
    '--mint-ink': a.ink,
    '--mint-dark': a.dark,
    '--mint-wash': a.wash,
    '--disp': FONT_VAR[p.theme.font] ?? FONT_VAR.Outfit,
  } as React.CSSProperties;
}
