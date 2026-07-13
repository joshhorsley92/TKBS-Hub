'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_MARK, I } from './icons';
import { useWorkspace } from './WorkspaceProvider';
import { PAGE_HREF, PAGE_LABEL, type PageKey } from '@/lib/workspace';

const PAGE_ICON: Record<PageKey, (p: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  pulse: I.pulse,
  init: I.init,
  pipeline: I.funnel,
  clients: I.clients,
  builds: I.builds,
  money: I.money,
  time: I.time,
};

// A nav item is active when the current path is its page or lives beneath it.
// '/' only matches exactly, or every item would light up on Pulse.
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Rail() {
  const pathname = usePathname();
  const { person, other, profile, editing, toggleEditing, switchMe } = useWorkspace();

  return (
    <div className="rail">
      <div className="brand">
        {BRAND_MARK}
        <div className="wm">
          TKBS<span>.</span>
        </div>
      </div>

      <nav className="nav">
        {profile.nav.map((key) => {
          const Icon = PAGE_ICON[key];
          const href = PAGE_HREF[key];
          return (
            <Link key={key} href={href} className={isActive(pathname, href) ? 'on' : ''}>
              <Icon />
              {PAGE_LABEL[key]}
            </Link>
          );
        })}
      </nav>

      <div className="foot">
        <Link href="/connections" className={`navlite${isActive(pathname, '/connections') ? ' on' : ''}`}>
          <I.plug />
          Connections
        </Link>
        <button className={`navlite${editing ? ' on' : ''}`} onClick={toggleEditing}>
          <I.sliders />
          Customize workspace
        </button>

        <div className="who">
          <span className="ava" style={{ background: person.color }}>
            {person.initials}
          </span>
          <div className="meta">
            <b>{person.first}</b>
            <br />
            <span>{person.role}</span>
          </div>
          <button
            className="swap"
            aria-label={`Switch to ${other.first}’s workspace`}
            title={`Switch to ${other.first}’s workspace`}
            onClick={() => switchMe(other.key)}
          >
            ⇄
          </button>
        </div>
      </div>
    </div>
  );
}
