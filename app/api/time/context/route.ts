import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// What the hook needs to know BEFORE it spends a Claude call guessing.
//
// Given the working directory, answers: does the repo already tell us which
// client this is for? If it does (Foundations-Tree-Experts → Foundations), the
// hook doesn't ask — there's nothing to infer.
//
// If it doesn't — a SHARED repo like TKBS-Creative-Pipeline, which serves many
// clients — we hand back the real client list so the hook can ask Claude to pick
// from it. Only names on this list are ever accepted back.
export async function GET(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = auth === 'sync-secret' ? createServiceRoleClient() : await createServerSupabaseClient();
  const cwd = new URL(request.url).searchParams.get('cwd') ?? '';

  const { data: repos } = await supabase.from('repos').select('id, name, client_id, venture_id');

  const path = cwd.replace(/\\/g, '/').toLowerCase();
  const hit =
    [...(repos ?? [])]
      .sort((a, b) => b.name.length - a.name.length)
      .find((r) => path.includes(`/${r.name.toLowerCase()}`)) ?? null;

  // The repo answers it → nothing to infer, and we don't burn a Claude call.
  if (hit?.client_id) {
    return NextResponse.json({ needsClient: false, clients: [] });
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .not('stage', 'eq', 'past')
    .order('name');

  return NextResponse.json({
    needsClient: true,
    repo: hit?.name ?? null,
    clients: clients ?? [],
  });
}
