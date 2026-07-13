// Shared vocabulary for the Broadsheet console: colours, source mapping,
// ownership derivation, and the formatters. Pure — safe on client and server.

/* ── people ──────────────────────────────────────────────────────────────── */

export type PersonKey = 'joe' | 'josh' | 'savannah';

/** Sidebar / filter / picker order. Not alphabetical — it's how the studio reads. */
export const PEOPLE_ORDER: PersonKey[] = ['joe', 'josh', 'savannah'];

export type Person = {
  key: PersonKey;
  id: string; // profiles.id
  name: string;
  first: string;
  initials: string;
  role: string;
  color: string;
  /** False until they have a Supabase auth user — on the board, can't log in. */
  canSignIn: boolean;
};

export const PERSON_COLOR: Record<PersonKey, string> = {
  joe: '#00A183', // Electric Mint
  josh: '#3B7BE0', // Cobalt
  savannah: '#7C5CF0', // Violet
};

/** The chip tone that carries each person's colour. */
export const PERSON_TONE: Record<PersonKey, 'mint' | 'blue' | 'violet'> = {
  joe: 'mint',
  josh: 'blue',
  savannah: 'violet',
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/* ── sources ─────────────────────────────────────────────────────────────── */

// work_log.source is ('manual' | 'git' | 'freshbooks' | 'other'). The board
// speaks in five lanes; 'manual' and 'other' land in the Hub lane.
export type Src = 'git' | 'freshbooks' | 'cal' | 'crm' | 'hub';

export const SRC_LABEL: Record<Src, string> = {
  git: 'GIT',
  freshbooks: 'FBK',
  cal: 'CAL',
  hub: 'HUB',
  crm: 'CRM',
};

export const SRC_COLOR: Record<Src, string> = {
  git: '#1B2838',
  freshbooks: '#3B7BE0',
  cal: '#E8B90A',
  hub: '#C77706',
  crm: '#00A183',
};

export const SRC_LEGEND: [Src, string][] = [
  ['git', 'GitHub commits'],
  ['freshbooks', 'FreshBooks'],
  ['crm', 'CRM leads'],
  ['cal', 'Calendar'],
  ['hub', 'Hub actions'],
];

export function toSrc(source: string | null | undefined): Src {
  if (source === 'git' || source === 'freshbooks' || source === 'cal' || source === 'crm') return source;
  return 'hub';
}

/* ── ownership ───────────────────────────────────────────────────────────── */
// Derived from source, overridable by an explicit assignment.
//
// Savannah owns FreshBooks and keeps the books, so the obvious move was to
// route the money lane to her. Josh's call was no: he and Savannah are equal on
// money decisions, so the FreshBooks lane still lands on him by default — she
// simply isn't blocked from any of it. Nothing auto-assigns to Savannah; she is
// fully assignable, everywhere, by hand.
export const SRC_OWNER: Record<Src, PersonKey> = {
  git: 'joe',
  freshbooks: 'josh',
  crm: 'josh',
  cal: 'josh',
  hub: 'josh',
};

export function ownerOf(item: { assignedOwner?: PersonKey | null; src?: Src | null; owner?: PersonKey | null }): PersonKey {
  return item.assignedOwner ?? (item.src ? SRC_OWNER[item.src] : undefined) ?? item.owner ?? 'josh';
}

/* ── domain colours ──────────────────────────────────────────────────────── */

/** A point on a client's life-line. Mirrors board.ts `LifeEvent`, but lives here
 *  so client components can type against it without importing server-only code. */
export type LifeEventLike = {
  d: string;
  type: string;
  t: string;
  by: string | null;
  src: Src;
  amt: number | null;
  flag?: boolean;
};

export const LIFE_TYPE_COLOR: Record<string, string> = {
  enter: '#9aa6b8',
  discovery: '#3B7BE0',
  meeting: '#3B7BE0',
  proposal: '#7C5CF0',
  signed: '#00A183',
  money: '#00A183',
  work: '#1B2838',
  note: '#C77706',
  upcoming: '#00A183',
};

// ventures.kind → the build-kind dot
export const BUILD_KIND_COLOR: Record<string, string> = {
  service_line: '#7C5CF0',
  product: '#3B7BE0',
  internal: '#00A183',
  agency_offer: '#C77706',
};

export const BUILD_KIND_LABEL: Record<string, string> = {
  service_line: 'service line',
  product: 'product',
  internal: 'internal',
  agency_offer: 'agency offer',
};

export const PLATFORM: Record<string, { label: string; color: string; glyph: string }> = {
  meta: { label: 'Meta', color: '#3B7BE0', glyph: 'f' },
  google: { label: 'Google', color: '#C77706', glyph: 'G' },
  organic: { label: 'Organic', color: '#00A183', glyph: '✦' },
};

// Funnel stages and the probability each carries when weighting the pipeline.
export const STAGES: [string, string, number][] = [
  ['new', 'New', 0.1],
  ['qualified', 'Qualified', 0.35],
  ['proposal', 'Proposal', 0.6],
  ['won', 'Won', 1.0],
];

export const STAGE_PROB: Record<string, number> = {
  new: 0.1,
  qualified: 0.35,
  proposal: 0.6,
  won: 1.0,
  lost: 0,
};

export const fitColor = (f: number): string =>
  f >= 80 ? 'var(--mint-ink)' : f >= 65 ? 'var(--blue)' : 'var(--amber)';

/* ── formatters ──────────────────────────────────────────────────────────── */
// The never-fabricate rule lives here: null is "we don't know" and renders as
// an em dash. It is NEVER coerced to zero.

export const DASH = '—';

export function money(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return DASH;
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return DASH;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

// Compact form for headline numbers: $29.8k
export function moneyK(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  if (Math.abs(n) < 1000) return money(n);
  return `$${(n / 1000).toFixed(1)}k`;
}

export function num(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return DASH;
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return DASH;
  return v.toLocaleString('en-US');
}

export const fmt = (d: string | Date): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fmtY = (d: string | Date): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

export const tme = (d: string | Date): string =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const DAY = 86_400_000;

export function daysAgo(d: string | Date, now: Date = new Date()): number {
  return Math.round((now.getTime() - new Date(d).getTime()) / DAY);
}

export function ago(d: string | Date | null | undefined, now: Date = new Date()): string {
  if (!d) return DASH;
  const n = daysAgo(d, now);
  if (n <= 0) return 'today';
  if (n === 1) return '1d ago';
  if (n < 30) return `${n}d ago`;
  return `${Math.round(n / 30)}mo ago`;
}

// Whole days from `now` to `d`. Compared date-to-date so "today" means today,
// not "within 24h".
export function daysUntil(d: string | Date, now: Date = new Date()): number {
  const a = new Date(d);
  const start = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((start(a) - start(now)) / DAY);
}

export function until(d: string | Date | null | undefined, now: Date = new Date()): string {
  if (!d) return DASH;
  const n = daysUntil(d, now);
  if (n < 0) return 'past';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n}d`;
}

// Due-pill text for the look-ahead: overdue reads as debt, not as a date.
export function dueText(d: string | Date, now: Date = new Date()): string {
  const n = daysUntil(d, now);
  if (n < 0) return `${Math.abs(n)}d late`;
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n}d`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
