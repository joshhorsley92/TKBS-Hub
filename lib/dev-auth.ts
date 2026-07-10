import { createServiceRoleClient } from '@/lib/supabase/server';

// ── DEV AUTH BYPASS ─────────────────────────────────────────────────────────
// While TKBS gets organized, DEV_BYPASS_AUTH=1 removes the password gate:
// every request acts as DEV_USER (default joe@) with full data access.
// - Only honored outside production builds, and never silently: the status
//   bar shows an amber "AUTH BYPASS" warning whenever it's active.
// - Actions still attribute to a real profile so the awareness loop keeps
//   meaning. Flip the env var off to restore real Supabase Auth — nothing
//   else changes.

export function isAuthBypass(): boolean {
  return process.env.DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production';
}

export type DevUser = { id: string; name: string; email: string; role: 'owner' | 'engineer' };

let cached: DevUser | null = null;

export async function getDevUser(): Promise<DevUser | null> {
  if (!isAuthBypass()) return null;
  if (cached) return cached;

  const email = process.env.DEV_USER ?? 'joe@tkbsmarketing.com';
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('email', email)
    .single();

  cached = (data as DevUser | null) ?? null;
  return cached;
}
