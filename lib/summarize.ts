import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '@/lib/supabase/server';

// AI "current work" summaries: distills a repo's recent commit history into
// 2-3 sentences of what's actually being built right now. Generated on
// demand (button on the repo page) — never automatic, so token spend is a
// deliberate act. Grounded ONLY in real commit data; the prompt forbids
// invention (Josh rule applies to prose too).

const MODEL = process.env.SUMMARY_MODEL || 'claude-opus-4-8';

export async function summarizeRepo(repoId: string): Promise<{ summary: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to .env.local');
  }

  const supabase = createServiceRoleClient();

  const { data: repo } = await supabase
    .from('repos')
    .select('id, org, name, purpose, category')
    .eq('id', repoId)
    .single();
  if (!repo) throw new Error('repo not found');

  const { data: commits } = await supabase
    .from('work_log')
    .select('title, occurred_at, actor_raw, profiles:actor_id (name)')
    .eq('repo_id', repoId)
    .eq('kind', 'commit')
    .order('occurred_at', { ascending: false })
    .limit(30)
    .returns<
      { title: string; occurred_at: string; actor_raw: string | null; profiles: { name: string } | null }[]
    >();

  if (!commits || commits.length === 0) {
    throw new Error('no commit history ingested for this repo — run a sync first');
  }

  const commitLines = commits
    .map((c) => {
      const who = c.profiles?.name?.split(' ')[0] ?? c.actor_raw?.split(' ')[0] ?? 'unknown';
      const when = new Date(c.occurred_at).toISOString().slice(0, 10);
      return `${when} [${who}] ${c.title}`;
    })
    .join('\n');

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      'You summarize software repository activity for a 2-person agency dashboard. ' +
      'Write 2-3 plain sentences describing what is currently being built or changed ' +
      'in this repo, based ONLY on the commit subjects provided. Name the concrete ' +
      'features/areas from the commits. Never invent work that the commits do not ' +
      'show; if activity is sparse or old, say so plainly. No preamble, no bullets.',
    messages: [
      {
        role: 'user',
        content: `Repo: ${repo.org}/${repo.name} (${repo.category})${repo.purpose ? `\nStated purpose: ${repo.purpose}` : ''}\n\nMost recent commits (newest first):\n${commitLines}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('empty summary returned');

  await supabase
    .from('repos')
    .update({ work_summary: text, work_summary_at: new Date().toISOString() })
    .eq('id', repoId);

  return { summary: text };
}
