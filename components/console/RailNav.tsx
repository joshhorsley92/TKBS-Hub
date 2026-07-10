'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  CircleDollarSign,
  FolderGit2,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Cockpit', icon: LayoutDashboard },
  { href: '/feed', label: 'Feed', icon: Activity },
  { href: '/repos', label: 'Repos', icon: FolderGit2 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/money', label: 'Money', icon: CircleDollarSign },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function RailNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-1" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'grid h-[34px] w-9 place-items-center rounded-console bg-panel-2 text-mint shadow-[inset_2px_0_0_var(--color-mint)]'
                : 'grid h-[34px] w-9 place-items-center rounded-console text-ink-4 transition hover:text-ink-2'
            }
          >
            <Icon size={16} />
          </Link>
        );
      })}
    </nav>
  );
}
