import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAuthBypass } from '@/lib/dev-auth';
import { safeQuery } from '@/lib/data';
import { getPeople, getWorkspaces } from '@/lib/board';
import { WorkspaceProvider, Shell } from '@/components/broadsheet/WorkspaceProvider';
import type { Destination } from '@/components/broadsheet/AskClaude';

export const dynamic = 'force-dynamic';

/** The ⌘K jump index — real records only, so it can never offer a dead link. */
async function getDestinations(): Promise<Destination[]> {
  const [clients, builds, initiatives] = await Promise.all([
    safeQuery<{ id: string; name: string }[]>((s) => s.from('clients').select('id, name')),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('ventures').select('id, name')),
    safeQuery<{ id: string; title: string }[]>((s) => s.from('initiatives').select('id, title')),
  ]);

  return [
    { label: 'Pulse', href: '/', hint: 'screen' },
    { label: 'Initiatives', href: '/initiatives', hint: 'screen' },
    { label: 'Pipeline', href: '/pipeline', hint: 'screen' },
    { label: 'Clients', href: '/clients', hint: 'screen' },
    { label: 'Builds', href: '/builds', hint: 'screen' },
    { label: 'Money', href: '/money', hint: 'screen' },
    { label: 'Timeline', href: '/timeline', hint: 'screen' },
    { label: 'Connections', href: '/connections', hint: 'screen' },
    ...(clients ?? []).map((c) => ({ label: c.name, href: `/clients/${c.id}`, hint: 'client' })),
    ...(builds ?? []).map((b) => ({ label: b.name, href: `/builds/${b.id}`, hint: 'build' })),
    ...(initiatives ?? []).map((i) => ({ label: i.title, href: `/initiatives/${i.id}`, hint: 'initiative' })),
  ];
}

export default async function AuthedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthBypass()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
  }

  const people = await getPeople();

  // The whole console is keyed on the two founder profiles. Without them there
  // is nothing honest to render, so say so rather than paint an empty board.
  if (!people) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', padding: 24 }}>
        <div className="empty-state" style={{ maxWidth: 520 }}>
          <div className="es-t">The hub can’t reach its profiles.</div>
          <div className="es-s">
            Supabase is unreachable, or the <code>profiles</code> table has no owner/engineer rows.
            Check <code>NEXT_PUBLIC_SUPABASE_URL</code> in <code>.env.local</code>, then run{' '}
            <code>node scripts/seed-users.mjs</code>. Nothing is rendered until there’s real data to
            render.
          </div>
        </div>
      </div>
    );
  }

  const [workspaces, destinations] = await Promise.all([getWorkspaces(people), getDestinations()]);

  return (
    <WorkspaceProvider
      people={people.byKey}
      peopleById={people.byId}
      initial={workspaces}
      destinations={destinations}
    >
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
