import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Receives a tracked session from the Claude Code hook (or a manual entry).
//
// UPSERT on external_id: the hook re-derives the whole session from its
// transcript on every turn and re-posts it, so this is called many times per
// session and must converge on one row rather than piling up.
//
// ATTRIBUTION: derived from the working directory the session ran in, by
// matching it against the repos the hub already knows about. If nothing
// matches, the session is stored UNATTRIBUTED — a real state that the hub
// surfaces for a human to assign. It is never guessed, and never silently
// dropped on the floor.

export const maxDuration = 30;

const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

/** Match a filesystem path to a repo by its folder name. */
function matchRepo(cwd: string, repos: { id: string; name: string; client_id: string | null; venture_id: string | null }[]) {
  const path = cwd.replace(/\\/g, '/').toLowerCase();
  // Longest name first, so "TKBS-Hub" doesn't lose to a shorter substring.
  const sorted = [...repos].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((r) => path.includes(`/${r.name.toLowerCase()}`)) ?? null;
}

export async function POST(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const externalId = typeof body?.external_id === 'string' ? body.external_id : null;
  if (!externalId) return NextResponse.json({ error: 'external_id is required' }, { status: 400 });
  if (!body?.started_at) return NextResponse.json({ error: 'started_at is required' }, { status: 400 });

  const supabase = auth === 'sync-secret' ? createServiceRoleClient() : auth.supabase;

  // ── WHO ────────────────────────────────────────────────────────────────
  // The hook authenticates with a shared secret, which carries NO identity.
  // This used to fall through to DEV_USER, which meant EVERY session — Joe's,
  // Josh's, anyone's — was logged as Joe. Silent misattribution: worse than no
  // data, because it looks like data.
  //
  // The machine's git email is the answer, and `identities` already maps it —
  // it's how commits get attributed. If it doesn't resolve we store NULL and
  // keep the raw email, so the board can ASK. We never guess a person.
  let profileId: string | null = auth === 'sync-secret' ? null : auth.userId;
  const actorEmail = typeof body?.actor_email === 'string' ? body.actor_email.toLowerCase().trim() : null;

  if (!profileId && actorEmail) {
    const { data: identity } = await supabase
      .from('identities')
      .select('profile_id')
      .eq('kind', 'git_email')
      .ilike('value', actorEmail)
      .maybeSingle();
    profileId = identity?.profile_id ?? null;

    // A person may also be identifiable by their hub login address.
    if (!profileId) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', actorEmail)
        .maybeSingle();
      profileId = byEmail?.id ?? null;
    }
  }

  // Attribute from the working directory, via the repo map.
  let clientId: string | null = body.client_id ?? null;
  let ventureId: string | null = body.venture_id ?? null;
  let repoId: string | null = body.repo_id ?? null;

  if (!repoId && typeof body.cwd === 'string') {
    const { data: repos } = await supabase.from('repos').select('id, name, client_id, venture_id');
    const hit = matchRepo(body.cwd, repos ?? []);
    if (hit) {
      repoId = hit.id;
      clientId = clientId ?? hit.client_id;
      ventureId = ventureId ?? hit.venture_id;
    }
  }

  const row = {
    external_id: externalId,
    source: body.source === 'manual' ? 'manual' : 'claude',
    // NULL when we couldn't identify them. The board shows it as "unknown
    // person" and asks — it does not put the hours on someone's ledger.
    profile_id: profileId,
    actor_raw: profileId ? null : actorEmail,
    // A suggestion, not an attribution. Nothing sums over it; a human confirms
    // it into client_id with one click.
    suggested_client_id: clientId ? null : (body.suggested_client_id ?? null),
    suggested_reason: clientId ? null : (body.suggested_reason ?? null),
    client_id: clientId,
    venture_id: ventureId,
    repo_id: repoId,
    started_at: body.started_at,
    ended_at: body.ended_at ?? null,
    worked_seconds: int(body.worked_seconds),
    idle_seconds: int(body.idle_seconds),
    model: body.model ?? null,
    input_tokens: int(body.input_tokens),
    output_tokens: int(body.output_tokens),
    cache_read_tokens: int(body.cache_read_tokens),
    cache_write_5m_tokens: int(body.cache_write_5m_tokens),
    cache_write_1h_tokens: int(body.cache_write_1h_tokens),
    // Null when the model isn't in the price table — unknown, not free.
    imputed_cost: body.imputed_cost ?? null,
    cwd: body.cwd ?? null,
    updated_at: new Date().toISOString(),
    // Only overwrite the summary when we actually have one; a mid-session Stop
    // shouldn't wipe the summary a SessionEnd already wrote.
    ...(body.summary ? { summary: String(body.summary).slice(0, 500) } : {}),
  };

  const { error } = await supabase.from('time_sessions').upsert(row, { onConflict: 'external_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, attributed: Boolean(clientId || ventureId) });
}
