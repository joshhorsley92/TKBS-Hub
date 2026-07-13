// Server-side data layer for the Broadsheet console.
//
// Every figure the board renders comes from here, and here reads only from
// Supabase (which in turn is fed by GitHub + FreshBooks sync). There is no
// sample data anywhere in this file. Where a source hasn't been connected or a
// human hasn't entered a value, the field is `null` and the UI renders "—".
// A `null` is never coerced to `0`.

import 'server-only';

import { cache } from 'react';
import { safeQuery } from './data';
import {
  type PersonKey,
  type Src,
  type Person,
  PERSON_COLOR,
  PEOPLE_ORDER,
  initialsOf,
  toSrc,
  SRC_OWNER,
} from './broadsheet';
import { type WorkspaceProfile, mergeProfile } from './workspace';

/* ── people ──────────────────────────────────────────────────────────────── */

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  role: 'owner' | 'engineer' | 'bookkeeper';
  auth_user_id: string | null;
};

/** Resolve a profile row onto one of the board's seats. */
function personKeyOf(p: ProfileRow): PersonKey {
  // Role is the primary signal — it's the one field that's always set.
  // Savannah has no email yet, so the email fallback has to tolerate null.
  if (p.role === 'owner') return 'josh';
  if (p.role === 'bookkeeper') return 'savannah';
  if (p.email?.startsWith('josh')) return 'josh';
  if (p.email?.startsWith('savannah') || /savannah/i.test(p.name)) return 'savannah';
  return 'joe';
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  engineer: 'Engineering',
  bookkeeper: 'Bookkeeping',
};

export type People = {
  /** Everyone on the board, in reading order. */
  list: Person[];
  /** Present only for seats that actually have a profile row. */
  byKey: Partial<Record<PersonKey, Person>>;
  byId: Record<string, Person>;
};

const getPeopleUncached = async (): Promise<People | null> => {
  const rows = await safeQuery<ProfileRow[]>((s) =>
    s.from('profiles').select('id, name, email, role, auth_user_id'),
  );
  if (!rows?.length) return null;

  const byKey: Partial<Record<PersonKey, Person>> = {};
  const byId: Record<string, Person> = {};

  for (const r of rows) {
    const key = personKeyOf(r);
    const person: Person = {
      key,
      id: r.id,
      name: r.name,
      first: r.name.split(/\s+/)[0] ?? r.name,
      initials: initialsOf(r.name),
      role: ROLE_LABEL[r.role] ?? r.role,
      color: PERSON_COLOR[key],
      // Savannah is on the board but has no auth user yet — she can be assigned
      // work and viewed-as, she just can't sign in. See migration 0006.
      canSignIn: Boolean(r.auth_user_id),
    };
    byKey[key] = person;
    byId[r.id] = person;
  }

  // Joe and Josh are load-bearing: the board's ownership derivation and the
  // default workspaces assume both exist. Savannah is optional — if her profile
  // is missing the console simply shows two seats instead of three.
  if (!byKey.joe || !byKey.josh) return null;

  const list = PEOPLE_ORDER.map((k) => byKey[k]).filter((p): p is Person => Boolean(p));
  return { list, byKey, byId };
};

/** Request-scoped: deduped across every caller in a single render. */
export const getPeople = cache(getPeopleUncached);

/* ── workspaces ──────────────────────────────────────────────────────────── */

export async function getWorkspaces(
  people: People,
): Promise<Partial<Record<PersonKey, WorkspaceProfile>>> {
  const rows = await safeQuery<{ profile_id: string; prefs: unknown }[]>((s) =>
    s.from('workspace_prefs').select('profile_id, prefs'),
  );
  const saved = new Map((rows ?? []).map((r) => [r.profile_id, r.prefs]));

  const out: Partial<Record<PersonKey, WorkspaceProfile>> = {};
  for (const person of people.list) {
    out[person.key] = mergeProfile(saved.get(person.id), person.key);
  }
  return out;
}

/* ── signals (the activity river) ────────────────────────────────────────── */

export type Signal = {
  id: string;
  at: string;
  src: Src;
  title: string;
  actorId: string | null;
  repoId: string | null;
  repoName: string | null;
  clientId: string | null;
  clientName: string | null;
  kind: string;
  url: string | null;
};

type WorkLogRow = {
  id: string;
  source: string;
  kind: string;
  occurred_at: string;
  title: string;
  actor_id: string | null;
  repo_id: string | null;
  client_id: string | null;
  payload: { url?: string } | null;
  repos: Embed<{ id: string; name: string; client_id: string | null }>;
  clients: Embed<{ id: string; name: string }>;
};

const SIGNAL_SELECT =
  'id, source, kind, occurred_at, title, actor_id, repo_id, client_id, payload, repos:repo_id(id, name, client_id), clients:client_id(id, name)';

function toSignal(r: WorkLogRow): Signal {
  const repo = one(r.repos);
  const client = one(r.clients);
  return {
    id: String(r.id),
    at: r.occurred_at,
    src: toSrc(r.source),
    title: r.title,
    actorId: r.actor_id,
    repoId: r.repo_id,
    repoName: repo?.name ?? null,
    // A commit in a client's repo IS activity on that client, even when the
    // work_log row itself carries no client_id.
    clientId: r.client_id ?? repo?.client_id ?? null,
    clientName: client?.name ?? null,
    kind: r.kind,
    url: r.payload?.url ?? null,
  };
}

// Pulse alone used to hit work_log THREE times in one render — once for the
// signal river, once inside getInitiatives() to derive each initiative's latest
// signal, once inside getClients() to assemble life-lines. React's cache()
// dedupes per request, so the pool is fetched once and every caller slices it.
// Only a FILTERED query (Timeline) goes to the database on its own.
const SIGNAL_POOL = 300;

const signalPool = cache(async (): Promise<Signal[]> => {
  const rows = await safeQuery<WorkLogRow[]>((s) =>
    s.from('work_log').select(SIGNAL_SELECT).order('occurred_at', { ascending: false }).limit(SIGNAL_POOL),
  );
  return (rows ?? []).map(toSignal);
});

export async function getSignals(limit = 40, filters?: { src?: string; who?: string }): Promise<Signal[]> {
  const filtered = (filters?.src && filters.src !== 'all') || (filters?.who && filters.who !== 'all');

  if (!filtered) {
    // Anything within the pool is served from it; a bigger ask still hits the DB.
    if (limit <= SIGNAL_POOL) return (await signalPool()).slice(0, limit);
  }

  const rows = await safeQuery<WorkLogRow[]>((s) => {
    let q = s.from('work_log').select(SIGNAL_SELECT).order('occurred_at', { ascending: false }).limit(limit);
    if (filters?.src && filters.src !== 'all') {
      // 'hub' covers both hand-written ('manual') and uncategorised ('other').
      if (filters.src === 'hub') q = q.in('source', ['manual', 'other']);
      else q = q.eq('source', filters.src);
    }
    if (filters?.who && filters.who !== 'all') q = q.eq('actor_id', filters.who);
    return q;
  });
  return (rows ?? []).map(toSignal);
}

/* ── clients ─────────────────────────────────────────────────────────────── */

export type ClientMoney = {
  revenueActual: number | null;
  costActual: number | null;
  potentialMonthly: number | null;
};

export type LifeEvent = {
  d: string;
  type: string;
  t: string;
  by: string | null;
  src: Src;
  amt: number | null;
  flag?: boolean;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  stage: string;
  health: string | null;
  industry: string | null;
  website: string | null;
  engagement: string | null;
  since: string | null;
  notes: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  fbClientId: number | null;
  money: ClientMoney;
  /** The relationship arc — milestones, with delivery work clustered by month.
   *  Sized to be READ as a timeline. */
  line: LifeEvent[];
  /** Every event, uncollapsed — for the "Full history" river on the detail page. */
  history: LifeEvent[];
};

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  stage: string;
  health: string | null;
  industry: string | null;
  website: string | null;
  engagement: string | null;
  since: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  fb_client_id: number | null;
  created_at: string;
};

const CLIENT_SELECT =
  'id, name, slug, stage, health, industry, website, engagement, since, notes, contact_name, contact_email, contact_phone, fb_client_id, created_at';

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// The Supabase client here is untyped (no generated DB types), so PostgREST
// embeds infer as arrays even for many-to-one FKs, where the runtime value is a
// single object. Normalise both shapes rather than lying to the compiler.
type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * Assemble a client's life-line from the real record: when they entered, the
 * notes and stage changes logged against them, the commits in their repos, the
 * invoices they've paid, and what's scheduled next. If nothing has happened,
 * the line is just their entry point — which is the truth.
 */
function buildLifeLine(
  c: ClientRow,
  events: { kind: string; body: string; created_at: string; actor_id: string | null }[],
  signals: Signal[],
  invoices: { number: string | null; status: string; amount: number | null; paid: number | null; create_date: string | null; date_paid: string | null }[],
  upcoming: { title: string; due_on: string | null; profile_id: string }[],
): { line: LifeEvent[]; history: LifeEvent[] } {
  const line: LifeEvent[] = [];
  // The uncollapsed record — same events, every commit kept.
  const history: LifeEvent[] = signals.map((s) => ({
    d: s.at,
    type: 'work',
    t: s.title,
    by: s.actorId,
    src: s.src,
    amt: null,
  }));

  // Milestones land on BOTH the arc and the full history.
  const milestone = (e: LifeEvent) => {
    line.push(e);
    history.push(e);
  };

  const entered = c.since ?? c.created_at;
  if (entered) {
    milestone({ d: entered, type: 'enter', t: 'Entered as prospect', by: null, src: 'hub', amt: null });
  }

  for (const e of events) {
    milestone({
      d: e.created_at,
      type: e.kind === 'stage_change' ? 'proposal' : 'note',
      t: e.body,
      by: e.actor_id,
      src: 'hub',
      amt: null,
    });
  }

  // Work is CLUSTERED BY MONTH, not listed commit-by-commit.
  //
  // The life-line is the shape of a relationship — entered, discovered, signed,
  // worked, paid — and it holds maybe a dozen nodes before the labels collide
  // into noise. A client with 30 commits in one repo would bury every milestone
  // under a wall of overlapping text. So each month of delivery work becomes one
  // node ("14 commits"), which is both readable and true. The full commit list
  // lives on the Timeline and the repo page, where it belongs.
  const byMonth = new Map<string, Signal[]>();
  for (const s of signals) {
    const key = s.at.slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(s);
    else byMonth.set(key, [s]);
  }

  for (const [, group] of byMonth) {
    // Anchor the node at the month's most recent activity.
    const latest = group.reduce((a, b) => (new Date(a.at) > new Date(b.at) ? a : b));
    line.push({
      d: latest.at,
      type: 'work',
      t: group.length === 1 ? latest.title : `${group.length} commits`,
      by: group.length === 1 ? latest.actorId : null,
      src: latest.src,
      amt: null,
    });
  }

  for (const inv of invoices) {
    if (inv.date_paid) {
      milestone({
        d: inv.date_paid,
        type: 'money',
        t: `Invoice paid${inv.number ? ` — ${inv.number}` : ''}`,
        by: null,
        src: 'freshbooks',
        amt: numOrNull(inv.paid),
      });
    } else if (inv.create_date) {
      milestone({
        d: inv.create_date,
        type: 'proposal',
        t: `Invoice sent${inv.number ? ` — ${inv.number}` : ''}`,
        by: null,
        src: 'freshbooks',
        amt: numOrNull(inv.amount),
      });
    }
  }

  const now = Date.now();
  for (const t of upcoming) {
    if (t.due_on && new Date(t.due_on).getTime() >= now) {
      milestone({ d: t.due_on, type: 'upcoming', t: t.title, by: t.profile_id, src: 'cal', amt: null, flag: true });
    }
  }

  const byDate = (a: LifeEvent, b: LifeEvent) => new Date(a.d).getTime() - new Date(b.d).getTime();
  return { line: line.sort(byDate), history: history.sort(byDate) };
}

const getClientsUncached = async (): Promise<Client[]> => {
  const rows = await safeQuery<ClientRow[]>((s) => s.from(  'clients').select(CLIENT_SELECT).order('name'));
  if (!rows?.length) return [];

  const [moneyRows, eventRows, signalRows, repoRows, taskRows] = await Promise.all([
    safeQuery<{ client_id: string; revenue_actual: string | null; cost_actual: string | null; potential_monthly: string | null }[]>(
      (s) => s.from('v_client_money').select('client_id, revenue_actual, cost_actual, potential_monthly'),
    ),
    safeQuery<{ client_id: string; kind: string; body: string; created_at: string; actor_id: string | null }[]>((s) =>
      s.from('client_events').select('client_id, kind, body, created_at, actor_id').order('created_at'),
    ),
    getSignals(300),
    safeQuery<{ id: string; client_id: string | null }[]>((s) => s.from('repos').select('id, client_id')),
    safeQuery<{ client_id: string | null; title: string; due_on: string | null; profile_id: string }[]>((s) =>
      s.from('work_items').select('client_id, title, due_on, profile_id').in('status', ['now', 'next']),
    ),
  ]);

  const moneyBy = new Map((moneyRows ?? []).map((m) => [m.client_id, m]));
  const repoClient = new Map((repoRows ?? []).map((r) => [r.id, r.client_id]));

  return rows.map((c) => {
    const m = moneyBy.get(c.id);
    const mine = (signalRows ?? []).filter(
      (s) => s.clientId === c.id || (s.repoId ? repoClient.get(s.repoId) === c.id : false),
    );
    const { line, history } = buildLifeLine(
      c,
      (eventRows ?? []).filter((e) => e.client_id === c.id),
      mine,
      [],
      (taskRows ?? []).filter((t) => t.client_id === c.id),
    );
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      stage: c.stage,
      health: c.health,
      industry: c.industry,
      website: c.website,
      engagement: c.engagement,
      since: c.since,
      notes: c.notes,
      contactName: c.contact_name,
      contactEmail: c.contact_email,
      contactPhone: c.contact_phone,
      fbClientId: c.fb_client_id,
      money: {
        revenueActual: numOrNull(m?.revenue_actual),
        costActual: numOrNull(m?.cost_actual),
        potentialMonthly: numOrNull(m?.potential_monthly),
      },
      line,
      history,
    };
  });
};

/** Request-scoped: deduped across every caller in a single render. */
export const getClients = cache(getClientsUncached);

export async function getClient(id: string): Promise<Client | null> {
  const all = await getClients();
  return all.find((c) => c.id === id || c.slug === id) ?? null;
}

/* ── builds (ventures + the reuse map) ───────────────────────────────────── */

export type Build = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  blurb: string | null;
  /** Hand-entered; null when nobody has recorded it. Never inferred. */
  engHours: number | null;
  repos: { id: string; name: string; org: string }[];
  deployed: { clientId: string; clientName: string; since: string | null; role: string | null }[];
  candidates: { clientId: string; clientName: string }[];
  signal: Signal | null;
};

const getBuildsUncached = async (): Promise<Build[]> => {
  const [ventures, deployments, repos, clients, signals] = await Promise.all([
    safeQuery<{ id: string; slug: string; name: string; kind: string; status: string; blurb: string | null; eng_hours: string | null }[]>(
      (s) => s.from('ventures').select('id, slug, name, kind, status, blurb, eng_hours').order('name'),
    ),
    safeQuery<{ venture_id: string; client_id: string; status: string; since: string | null; role: string | null }[]>((s) =>
      s.from('build_deployments').select('venture_id, client_id, status, since, role'),
    ),
    safeQuery<{ id: string; name: string; org: string; venture_id: string | null }[]>((s) =>
      s.from('repos').select('id, name, org, venture_id').eq('is_active', true),
    ),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('clients').select('id, name')),
    getSignals(200),
  ]);
  if (!ventures?.length) return [];

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return ventures.map((v) => {
    const myRepos = (repos ?? []).filter((r) => r.venture_id === v.id);
    const repoIds = new Set(myRepos.map((r) => r.id));
    const deps = (deployments ?? []).filter((d) => d.venture_id === v.id);

    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      kind: v.kind,
      status: v.status,
      blurb: v.blurb,
      engHours: numOrNull(v.eng_hours),
      repos: myRepos.map((r) => ({ id: r.id, name: r.name, org: r.org })),
      deployed: deps
        .filter((d) => d.status === 'deployed')
        .map((d) => ({
          clientId: d.client_id,
          clientName: clientName.get(d.client_id) ?? 'Unknown',
          since: d.since,
          role: d.role,
        })),
      candidates: deps
        .filter((d) => d.status === 'candidate')
        .map((d) => ({ clientId: d.client_id, clientName: clientName.get(d.client_id) ?? 'Unknown' })),
      // Latest real commit in any repo mapped to this build.
      signal: (signals ?? []).find((s) => s.repoId && repoIds.has(s.repoId)) ?? null,
    };
  });
};

/** Request-scoped: deduped across every caller in a single render. */
export const getBuilds = cache(getBuildsUncached);

export async function getBuild(id: string): Promise<Build | null> {
  const all = await getBuilds();
  return all.find((b) => b.id === id || b.slug === id) ?? null;
}

/* ── initiatives ─────────────────────────────────────────────────────────── */

export type Initiative = {
  id: string;
  title: string;
  why: string | null;
  ownerId: string;
  lane: string;
  status: string;
  health: string | null;
  progress: number;
  blockedOnProfileId: string | null;
  blockedOnExternal: boolean;
  blockNote: string | null;
  repoId: string | null;
  repoName: string | null;
  clientId: string | null;
  clientName: string | null;
  ventureId: string | null;
  ventureName: string | null;
  signal: Signal | null;
  decisions: { id: number; body: string; actorId: string | null; at: string }[];
};

type InitRow = {
  id: string;
  title: string;
  why: string | null;
  owner_id: string;
  lane: string;
  status: string;
  health: string | null;
  progress: string | number;
  blocked_on_profile_id: string | null;
  blocked_on_external: boolean;
  block_note: string | null;
  repo_id: string | null;
  client_id: string | null;
  venture_id: string | null;
  created_at: string;
  repos: Embed<{ name: string }>;
  clients: Embed<{ name: string }>;
  ventures: Embed<{ name: string }>;
};

const getInitiativesUncached = async (): Promise<Initiative[]> => {
  const [rows, logs, signals] = await Promise.all([
    safeQuery<InitRow[]>((s) =>
      s
        .from('initiatives')
        .select(
          'id, title, why, owner_id, lane, status, health, progress, blocked_on_profile_id, blocked_on_external, block_note, repo_id, client_id, venture_id, created_at, repos:repo_id(name), clients:client_id(name), ventures:venture_id(name)',
        )
        .order('created_at', { ascending: false }),
    ),
    safeQuery<{ id: number; initiative_id: string; body: string; actor_id: string | null; created_at: string }[]>((s) =>
      s
        .from('initiative_decisions')
        .select('id, initiative_id, body, actor_id, created_at')
        .order('created_at', { ascending: false }),
    ),
    getSignals(200),
  ]);
  if (!rows?.length) return [];

  return rows.map((i) => ({
    id: i.id,
    title: i.title,
    why: i.why,
    ownerId: i.owner_id,
    lane: i.lane,
    status: i.status,
    health: i.health,
    progress: Number(i.progress) || 0,
    blockedOnProfileId: i.blocked_on_profile_id,
    blockedOnExternal: i.blocked_on_external,
    blockNote: i.block_note,
    repoId: i.repo_id,
    repoName: one(i.repos)?.name ?? null,
    clientId: i.client_id,
    clientName: one(i.clients)?.name ?? null,
    ventureId: i.venture_id,
    ventureName: one(i.ventures)?.name ?? null,
    // The "latest auto-signal": the most recent real commit on the linked repo,
    // or the most recent activity on the linked client.
    signal:
      (signals ?? []).find((s) => (i.repo_id && s.repoId === i.repo_id) || (i.client_id && s.clientId === i.client_id)) ??
      null,
    decisions: (logs ?? [])
      .filter((l) => l.initiative_id === i.id)
      .map((l) => ({ id: l.id, body: l.body, actorId: l.actor_id, at: l.created_at })),
  }));
};

/** Request-scoped: deduped across every caller in a single render. */
export const getInitiatives = cache(getInitiativesUncached);

export async function getInitiative(id: string): Promise<Initiative | null> {
  const all = await getInitiatives();
  return all.find((i) => i.id === id) ?? null;
}

/* ── look-ahead tasks ────────────────────────────────────────────────────── */

export type Task = {
  id: string;
  title: string;
  dueOn: string;
  src: Src;
  profileId: string;
  clientId: string | null;
  ventureId: string | null;
  repoId: string | null;
};

/** Open, dated work — the rolling today→+14d window is applied in the UI. */
const getTasksUncached = async (): Promise<Task[]> => {
  const rows = await safeQuery<
    {
      id: string;
      title: string;
      due_on: string | null;
      source: string;
      profile_id: string;
      client_id: string | null;
      venture_id: string | null;
      repo_id: string | null;
    }[]
  >((s) =>
    s
      .from('work_items')
      .select('id, title, due_on, source, profile_id, client_id, venture_id, repo_id')
      .in('status', ['now', 'next'])
      .not('due_on', 'is', null)
      .order('due_on'),
  );

  return (rows ?? [])
    .filter((r): r is typeof r & { due_on: string } => Boolean(r.due_on))
    .map((r) => ({
      id: r.id,
      title: r.title,
      dueOn: r.due_on,
      src: toSrc(r.source),
      profileId: r.profile_id,
      clientId: r.client_id,
      ventureId: r.venture_id,
      repoId: r.repo_id,
    }));
};

/** Request-scoped: deduped across every caller in a single render. */
export const getTasks = cache(getTasksUncached);

/* ── attention ("Needs deciding") ────────────────────────────────────────── */
// DERIVED, not stored. An item only appears here because something real is
// true: an initiative is blocked, or a client's health was set to yellow/red.
// Nothing on this list is invented, and nothing sits here without a cause.

export type Attention = {
  id: string;
  sev: 'warn' | 'info';
  title: string;
  sub: string;
  src: Src;
  ownerKey: PersonKey;
  /** True when the owner came from an explicit assignment rather than the source. */
  assigned: boolean;
  href: string;
  initiativeId?: string;
};

export function deriveAttention(
  initiatives: Initiative[],
  clients: Client[],
  people: People,
): Attention[] {
  const out: Attention[] = [];

  for (const i of initiatives) {
    if (i.status !== 'active' && i.status !== 'evaluating') continue;
    if (!i.blockedOnProfileId && !i.blockedOnExternal) continue;

    const blocker = i.blockedOnExternal
      ? 'the client'
      : (people.byId[i.blockedOnProfileId!]?.first ?? 'someone');

    // The owner of a blocked initiative is whoever can unblock it: the person
    // it's blocked on, or — if it's blocked externally — its owner.
    const ownerId = i.blockedOnExternal ? i.ownerId : i.blockedOnProfileId!;
    const owner = people.byId[ownerId];

    out.push({
      id: `init:${i.id}`,
      sev: 'warn',
      title: i.title,
      sub: i.blockNote ?? `Blocked on ${blocker}.`,
      src: 'hub',
      ownerKey: owner?.key ?? 'josh',
      assigned: true,
      href: `/initiatives/${i.id}`,
      initiativeId: i.id,
    });
  }

  for (const c of clients) {
    if (c.health !== 'yellow' && c.health !== 'red') continue;
    out.push({
      id: `client:${c.id}`,
      sev: c.health === 'red' ? 'warn' : 'info',
      title: `${c.name} — health is ${c.health}`,
      sub: c.notes?.slice(0, 140) ?? 'Flagged on the client record. No note written.',
      src: 'crm',
      ownerKey: SRC_OWNER.crm,
      assigned: false,
      href: `/clients/${c.id}`,
    });
  }

  return out;
}

/* ── money ───────────────────────────────────────────────────────────────── */

export type MonthPoint = { month: string; revenueActual: number; revenuePotential: number; costActual: number; costPotential: number };

export type DecisionPnl = {
  id: string;
  title: string;
  status: string;
  kind: string;
  projectedRevenue: number | null;
  projectedCost: number | null;
  actualRevenue: number | null;
  actualCost: number | null;
};

export type CostLine = {
  id: string;
  memo: string | null;
  category: string;
  cadence: 'one_time' | 'monthly';
  amount: number;
  status: string;
};

export type MoneyBoard = {
  months: MonthPoint[];
  decisions: DecisionPnl[];
  costs: CostLine[];
  /** Sum of open, recurring revenue lines — the go-forward run-rate. */
  signedMonthly: number | null;
  /** Sum of open, monthly cost lines. */
  monthlySpend: number | null;
  investedOneTime: number | null;
  freshbooksConnected: boolean;
};

const MONTHS_AHEAD = 6;

const getMoneyUncached = async (): Promise<MoneyBoard> => {
  const [pnl, decisions, lines, fbToken] = await Promise.all([
    safeQuery<{ month: string; certainty: string; revenue: string | null; cost: string | null }[]>((s) =>
      s.from('v_company_pnl_monthly').select('month, certainty, revenue, cost').order('month'),
    ),
    safeQuery<
      {
        id: string;
        title: string;
        status: string;
        kind: string;
        projected_revenue: string | null;
        projected_cost: string | null;
        actual_revenue_to_date: string | null;
        actual_cost_to_date: string | null;
      }[]
    >((s) => s.from('v_decision_pnl').select('*')),
    safeQuery<
      { id: string; memo: string | null; category: string; cadence: 'one_time' | 'monthly'; amount: string; status: string; direction: string }[]
    >((s) =>
      s.from('money_lines').select('id, memo, category, cadence, amount, status, direction').eq('status', 'open'),
    ),
    safeQuery<{ provider: string }[]>((s) => s.from('integration_tokens').select('provider').eq('provider', 'freshbooks')),
  ]);

  // Six months from this one, whether or not there's data in them. An empty
  // month is a real answer: nothing is on the books.
  const start = new Date();
  start.setDate(1);
  const months: MonthPoint[] = [];
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = d.toISOString().slice(0, 7);
    const rows = (pnl ?? []).filter((r) => r.month?.slice(0, 7) === key);
    const pick = (certainty: string, field: 'revenue' | 'cost') =>
      Number(rows.find((r) => r.certainty === certainty)?.[field] ?? 0) || 0;
    months.push({
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      revenueActual: pick('actual', 'revenue'),
      revenuePotential: pick('projected', 'revenue'),
      costActual: pick('actual', 'cost'),
      costPotential: pick('projected', 'cost'),
    });
  }

  const revenueLines = (lines ?? []).filter((l) => l.direction === 'revenue');
  const costLines = (lines ?? []).filter((l) => l.direction === 'cost');

  // sum(empty) === null, deliberately: an empty ledger is unknown, not zero.
  const sum = (rows: { amount: string }[]): number | null =>
    rows.length ? rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) : null;

  return {
    months,
    decisions: (decisions ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      kind: d.kind,
      projectedRevenue: numOrNull(d.projected_revenue),
      projectedCost: numOrNull(d.projected_cost),
      actualRevenue: numOrNull(d.actual_revenue_to_date),
      actualCost: numOrNull(d.actual_cost_to_date),
    })),
    costs: costLines.map((l) => ({
      id: l.id,
      memo: l.memo,
      category: l.category,
      cadence: l.cadence,
      amount: Number(l.amount) || 0,
      status: l.status,
    })),
    signedMonthly: sum(revenueLines.filter((l) => l.cadence === 'monthly')),
    monthlySpend: sum(costLines.filter((l) => l.cadence === 'monthly')),
    investedOneTime: sum(costLines.filter((l) => l.cadence === 'one_time')),
    freshbooksConnected: Boolean(fbToken?.length),
  };
};

/** Request-scoped: deduped across every caller in a single render. */
export const getMoney = cache(getMoneyUncached);

/* ── pipeline ────────────────────────────────────────────────────────────── */

export type Campaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  note: string | null;
  leadCount: number;
};

export type Lead = {
  id: string;
  name: string;
  campaignId: string | null;
  campaignPlatform: string | null;
  fit: number | null;
  stage: string;
  estValue: number | null;
  recurring: boolean;
  industry: string | null;
  contact: string | null;
  note: string | null;
  clientId: string | null;
  createdAt: string;
};

export async function getPipeline(): Promise<{ campaigns: Campaign[]; leads: Lead[] }> {
  const [campaignRows, leadRows] = await Promise.all([
    safeQuery<
      { id: string; name: string; platform: string; status: string; spend: string | null; impressions: string | null; clicks: string | null; note: string | null }[]
    >((s) => s.from('campaigns').select('id, name, platform, status, spend, impressions, clicks, note').order('created_at', { ascending: false })),
    safeQuery<
      { id: string; name: string; campaign_id: string | null; fit: number | null; stage: string; est_value: string | null; recurring: boolean; industry: string | null; contact: string | null; note: string | null; client_id: string | null; created_at: string }[]
    >((s) => s.from('leads').select('*').order('created_at', { ascending: false })),
  ]);

  const campaigns = campaignRows ?? [];
  const leads = leadRows ?? [];
  const platformOf = new Map(campaigns.map((c) => [c.id, c.platform]));

  return {
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spend: numOrNull(c.spend),
      impressions: numOrNull(c.impressions),
      clicks: numOrNull(c.clicks),
      note: c.note,
      leadCount: leads.filter((l) => l.campaign_id === c.id).length,
    })),
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      campaignId: l.campaign_id,
      campaignPlatform: l.campaign_id ? (platformOf.get(l.campaign_id) ?? null) : null,
      fit: l.fit,
      stage: l.stage,
      estValue: numOrNull(l.est_value),
      recurring: l.recurring,
      industry: l.industry,
      contact: l.contact,
      note: l.note,
      clientId: l.client_id,
      createdAt: l.created_at,
    })),
  };
}

/* ── connections ─────────────────────────────────────────────────────────── */

export type Connection = {
  id: string;
  name: string;
  status: 'connected' | 'planned' | 'error';
  detail: string;
  rules: string[];
};

const getConnectionsUncached = async (): Promise<Connection[]> => {
  const [runs, repoSync, fbToken] = await Promise.all([
    safeQuery<{ job: string; status: string; finished_at: string | null; error: string | null; stats: Record<string, unknown> }[]>(
      (s) => s.from('ingest_runs').select('job, status, finished_at, error, stats').order('created_at', { ascending: false }).limit(20),
    ),
    safeQuery<{ last_synced_at: string | null }[]>((s) =>
      s.from('repos').select('last_synced_at').not('last_synced_at', 'is', null).order('last_synced_at', { ascending: false }).limit(1),
    ),
    safeQuery<{ provider: string }[]>((s) => s.from('integration_tokens').select('provider')),
  ]);

  const lastRun = (job: string) => (runs ?? []).find((r) => r.job === job);
  const ghRun = lastRun('github_poll');
  const fbRun = lastRun('freshbooks_sync');
  const fbConnected = Boolean(fbToken?.some((t) => t.provider === 'freshbooks'));

  const repoCount = await safeQuery<{ id: string }[]>((s) => s.from('repos').select('id').eq('is_active', true));
  const synced = repoSync?.[0]?.last_synced_at ?? null;

  const github: Connection = {
    id: 'github',
    name: 'GitHub',
    status: ghRun?.status === 'failed' ? 'error' : synced ? 'connected' : 'planned',
    detail:
      ghRun?.status === 'failed'
        ? (ghRun.error ?? 'Last sync failed')
        : synced
          ? `${repoCount?.length ?? 0} repos · last synced ${new Date(synced).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
          : 'Never synced',
    rules: ['Commits map to builds by repo', 'Repo activity feeds initiative signals'],
  };

  const freshbooks: Connection = {
    id: 'freshbooks',
    name: 'FreshBooks',
    status: fbConnected ? (fbRun?.status === 'failed' ? 'error' : 'connected') : 'planned',
    detail: fbConnected
      ? fbRun?.status === 'failed'
        ? (fbRun.error ?? 'Last sync failed')
        : `Last synced ${fbRun?.finished_at ? new Date(fbRun.finished_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}`
      : 'Not connected — revenue, cost and invoices read as unknown until it is',
    rules: ['Invoices & payments → client life-lines', 'Payments → Money actuals', 'Expenses → cost'],
  };

  return [
    github,
    freshbooks,
    {
      id: 'gcal',
      name: 'Google Calendar',
      status: 'planned',
      detail: 'Not wired — the look-ahead is fed by hand-entered work items for now',
      rules: ['Client meetings → life-lines', 'Events → 2-week look-ahead'],
    },
    {
      id: 'meta',
      name: 'Meta Business Suite',
      status: 'planned',
      detail: 'Not wired — Pipeline ad spend and reach are hand-entered until it is',
      rules: ['Ad spend & reach → campaigns', 'Leads → the funnel'],
    },
    {
      id: 'slack',
      name: 'Slack',
      status: process.env.SLACK_WEBHOOK_URL ? 'connected' : 'planned',
      detail: process.env.SLACK_WEBHOOK_URL
        ? 'Webhook configured — commit notifications and the daily digest post to Slack'
        : 'No webhook configured',
      rules: ['Commits → #build channel', 'Daily digest → Josh'],
    },
  ];
};

/** Request-scoped: deduped across every caller in a single render. */
export const getConnections = cache(getConnectionsUncached);
