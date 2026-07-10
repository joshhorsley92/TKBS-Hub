import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  CircleDollarSign,
  FolderGit2,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/SignOutButton';

// Provisional shell — Phase D (design direction) will replace the visual
// treatment; the nav structure is the approved one.
const NAV = [
  { href: '/', label: 'Cockpit', icon: LayoutDashboard },
  { href: '/feed', label: 'Feed', icon: Activity },
  { href: '/repos', label: 'Repos', icon: FolderGit2 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/money', label: 'Money', icon: CircleDollarSign },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default async function AuthedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-charcoal">
        <div className="px-5 py-6">
          <Link href="/" className="font-heading text-lg font-bold tracking-tight">
            TURN<span className="text-mint">KEY</span>{' '}
            <span className="font-normal text-ink-muted">HUB</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface hover:text-ink"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-edge px-5 py-4 text-sm text-ink-muted">
          <div className="mb-2">{profile?.name ?? user.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
