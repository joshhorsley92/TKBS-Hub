import 'server-only';

import { safeQuery } from './data';
import { getInitiatives, getMoney, getPeople, getTasks } from './board';
import { daysUntil, money } from './broadsheet';

// The daily digest.
//
// THE RULE: this function may only state things the database actually says.
// It computes a set of hard facts first, then either (a) hands those facts to
// Claude with an explicit instruction never to introduce a number that isn't in
// them, or (b) — when no API key is configured — renders the facts directly as
// a plain brief. Option (b) is not a degraded fallback so much as the honest
// floor: it can't hallucinate because it isn't generating anything.
//
// It never says "revenue held steady at $6.3k" unless $6.3k is in the ledger.

export type DigestFacts = {
  commits7d: number;
  reposTouched: number;
  byPerson: { first: string; commits: number }[];
  latestCommit: { title: string; at: string } | null;
  blocked: { title: string; on: string }[];
  dueThisWeek: number;
  overdue: number;
  activeInitiatives: number;
  signedMonthly: number | null;
  freshbooksConnected: boolean;
};

export async function collectFacts(): Promise<DigestFacts> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [people, commits, initiatives, tasks, moneyBoard] = await Promise.all([
    getPeople(),
    safeQuery<{ title: string; occurred_at: string; actor_id: string | null; repo_id: string | null }[]>((s) =>
      s
        .from('work_log')
        .select('title, occurred_at, actor_id, repo_id')
        .eq('source', 'git')
        .gte('occurred_at', since.toISOString())
        .order('occurred_at', { ascending: false }),
    ),
    getInitiatives(),
    getTasks(),
    getMoney(),
  ]);

  const rows = commits ?? [];
  const byPerson = people
    ? Object.values(people.byKey)
        .map((p) => ({ first: p.first, commits: rows.filter((r) => r.actor_id === p.id).length }))
        .filter((p) => p.commits > 0)
        .sort((a, b) => b.commits - a.commits)
    : [];

  const blocked = initiatives
    .filter((i) => (i.status === 'active' || i.status === 'evaluating') && (i.blockedOnProfileId || i.blockedOnExternal))
    .map((i) => ({
      title: i.title,
      on: i.blockedOnExternal
        ? 'the client'
        : (people?.byId[i.blockedOnProfileId!]?.first ?? 'someone'),
    }));

  return {
    commits7d: rows.length,
    reposTouched: new Set(rows.map((r) => r.repo_id).filter(Boolean)).size,
    byPerson,
    latestCommit: rows[0] ? { title: rows[0].title, at: rows[0].occurred_at } : null,
    blocked,
    dueThisWeek: tasks.filter((t) => {
      const n = daysUntil(t.dueOn);
      return n >= 0 && n <= 6;
    }).length,
    overdue: tasks.filter((t) => daysUntil(t.dueOn) < 0).length,
    activeInitiatives: initiatives.filter((i) => i.status === 'active').length,
    signedMonthly: moneyBoard.signedMonthly,
    freshbooksConnected: moneyBoard.freshbooksConnected,
  };
}

/** Render the facts as plain sentences. Generates nothing it wasn't given. */
export function factualBrief(f: DigestFacts, brief: boolean): string {
  const parts: string[] = [];

  if (f.commits7d === 0) {
    parts.push('No commits landed in the last seven days.');
  } else {
    const who = f.byPerson.length
      ? ` — ${f.byPerson.map((p) => `${p.commits} from ${p.first}`).join(', ')}`
      : '';
    parts.push(
      `${f.commits7d} commit${f.commits7d === 1 ? '' : 's'} across ${f.reposTouched} repo${f.reposTouched === 1 ? '' : 's'} in the last seven days${who}.`,
    );
  }

  if (f.blocked.length) {
    parts.push(
      `${f.blocked.length} initiative${f.blocked.length === 1 ? ' is' : 's are'} blocked: ${f.blocked
        .map((b) => `${b.title} (on ${b.on})`)
        .join('; ')}.`,
    );
  } else if (f.activeInitiatives > 0) {
    parts.push(`${f.activeInitiatives} active initiative${f.activeInitiatives === 1 ? '' : 's'}, none blocked.`);
  }

  if (f.overdue > 0) {
    parts.push(`${f.overdue} task${f.overdue === 1 ? ' is' : 's are'} overdue.`);
  }
  if (f.dueThisWeek > 0) {
    parts.push(`${f.dueThisWeek} due this week.`);
  }

  // Money is stated only when it's actually known.
  if (f.signedMonthly != null) {
    parts.push(`Signed run-rate is ${money(f.signedMonthly)}/mo.`);
  } else if (!f.freshbooksConnected) {
    parts.push('FreshBooks is not connected, so revenue and cost are unknown — not zero.');
  }

  if (brief) return parts.slice(0, 2).join(' ');
  return parts.join(' ');
}

/**
 * Write the digest. Uses Claude when ANTHROPIC_API_KEY is set, and hands it the
 * facts with a hard instruction not to introduce numbers. Falls back to the
 * facts themselves — which is never wrong, only drier.
 */
export async function writeDigest(brief: boolean): Promise<{ text: string; ai: boolean; facts: DigestFacts }> {
  const facts = await collectFacts();
  const floor = factualBrief(facts, brief);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { text: floor, ai: false, facts };

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key });

    const system = brief
      ? 'You write a two-sentence highlights brief for the owner of a two-person studio. Sentence one: what moved. Sentence two: the single most important thing to decide. Punchy, concrete, no preamble, no bullets.'
      : 'You write the stand-up recap for TKBS, a two-person studio (Joe = engineering, Josh = owner). One paragraph, three or four sentences: what moved, what is drifting, what is blocked. Warm, concrete, no fluff, no bullets, no preamble.';

    const msg = await client.messages.create({
      model: process.env.SUMMARY_MODEL || 'claude-opus-4-8',
      max_tokens: brief ? 200 : 400,
      system: `${system}

HARD CONSTRAINT: every figure you cite must appear verbatim in the FACTS below. Do not invent, estimate, round, or extrapolate any number, name, client, or dollar amount. If the facts say a value is unknown, say it is unknown — never substitute zero. If there is little to report, say so plainly and briefly.`,
      messages: [{ role: 'user', content: `FACTS (the only things known to be true):\n${JSON.stringify(facts, null, 2)}` }],
    });

    const text = msg.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    return text ? { text, ai: true, facts } : { text: floor, ai: false, facts };
  } catch {
    // An AI outage must never take the digest down — the facts still stand.
    return { text: floor, ai: false, facts };
  }
}
