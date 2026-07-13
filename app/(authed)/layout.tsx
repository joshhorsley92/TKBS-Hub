import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDevUser, isAuthBypass } from '@/lib/dev-auth';
import { isDbConfigured, safeQuery } from '@/lib/data';
import { age } from '@/lib/format';
import { ClaudeBar } from '@/components/console/ClaudeBar';
import { RailNav } from '@/components/console/RailNav';
import { SignOutButton } from '@/components/SignOutButton';

// Mission Control shell: icons-only rail + system status bar.
export default async function AuthedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const bypass = isAuthBypass();
  if (!bypass) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
  }
  const devUser = bypass ? await getDevUser() : null;

  // Sync freshness for the status bar (null = unknown, rendered honestly)
  const lastGithub = await safeQuery<{ last_synced_at: string | null }[]>((s) =>
    s
      .from('repos')
      .select('last_synced_at')
      .not('last_synced_at', 'is', null)
      .order('last_synced_at', { ascending: false })
      .limit(1),
  );
  const githubAge = lastGithub?.[0]?.last_synced_at ?? null;
  const dbUp = isDbConfigured();

  const now = new Date();
  const stamp = now
    .toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-edge py-3">
        <Link href="/" aria-label="TKBS Hub home" className="mb-3 block" title="TKBS Hub">
          {/* The key mark — circle head + shaft, Electric Mint, per Brand Guidelines */}
          <svg width="30" height="26" viewBox="0 0 34 26" aria-hidden="true">
            <circle cx="12" cy="13" r="9" fill="none" stroke="var(--color-mint)" strokeWidth="3" />
            <rect x="21" y="11" width="11" height="4" fill="var(--color-mint)" />
          </svg>
        </Link>
        <RailNav />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[18px] overflow-x-auto border-b border-edge px-[18px] py-[7px] font-mono text-[11px] text-ink-4">
          <span className="whitespace-nowrap">TKBS HUB // CONSOLE</span>
          {dbUp ? (
            <span className="whitespace-nowrap text-actual">● DB CONNECTED</span>
          ) : (
            <span className="whitespace-nowrap text-warn">● DB NOT CONNECTED — see supabase/README</span>
          )}
          {bypass && (
            <span className="whitespace-nowrap text-warn">
              ⚠ AUTH BYPASS{devUser ? ` — AS ${devUser.name.split(' ')[0].toUpperCase()}` : ''}
            </span>
          )}
          <span className="whitespace-nowrap">
            GITHUB {githubAge ? age(githubAge) : '—'}
          </span>
          <span className="whitespace-nowrap">FRESHBOOKS —</span>
          <span className="ml-auto whitespace-nowrap">{stamp}</span>
        </div>
        <main className="p-[16px_18px_70px]">{children}</main>
      </div>
      <ClaudeBar />
    </div>
  );
}
