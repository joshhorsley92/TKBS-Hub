import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDevUser, isAuthBypass } from '@/lib/dev-auth';

export type AuthedContext = {
  userId: string;
  name: string;
  role: 'owner' | 'engineer';
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
};

// Route-handler guard: resolves the logged-in user + their profile, or a 401.
// Usage: const auth = await requireAuth(); if (auth instanceof NextResponse) return auth;
export async function requireAuth(): Promise<AuthedContext | NextResponse> {
  const supabase = await createServerSupabaseClient();

  // DEV BYPASS: act as the configured dev user, no session needed.
  if (isAuthBypass()) {
    const dev = await getDevUser();
    if (!dev) {
      return NextResponse.json(
        { error: 'DEV_BYPASS_AUTH is on but DEV_USER has no profile — run scripts/seed-users.mjs' },
        { status: 500 },
      );
    }
    return { userId: dev.id, name: dev.name, role: dev.role, supabase };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'No hub profile' }, { status: 403 });
  }

  return {
    userId: user.id,
    name: profile.name,
    role: profile.role,
    supabase,
  };
}

// Sync routes accept EITHER a logged-in user OR the shared SYNC_SECRET header
// (lets a future cron/worker call them headlessly).
export async function requireAuthOrSyncSecret(
  request: Request,
): Promise<AuthedContext | 'sync-secret' | NextResponse> {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get('x-sync-secret');
  if (secret && provided && provided === secret) return 'sync-secret';
  return requireAuth();
}
