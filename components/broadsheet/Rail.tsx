'use client';

import { useState } from 'react';
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
  const { person, roster, profile, editing, toggleEditing, switchMe } = useWorkspace();
  const [open, setOpen] = useState(false);

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

        {/* Three seats now, so the old two-person ⇄ toggle can't express it —
            this is a picker. Closes on blur so it never traps focus. */}
        <div className="who" style={{ position: 'relative' }}>
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
            aria-label="Switch workspace"
            aria-expanded={open}
            aria-haspopup="menu"
            title="Switch workspace"
            onClick={() => setOpen((o) => !o)}
          >
            ⇄
          </button>

          {open && (
            <>
              <div className="whoscrim" onClick={() => setOpen(false)} />
              <div className="whomenu" role="menu">
                {roster.map((p) => (
                  <button
                    key={p.key}
                    role="menuitem"
                    className={`whoitem${p.key === person.key ? ' on' : ''}`}
                    onClick={() => {
                      setOpen(false);
                      if (p.key !== person.key) switchMe(p.key);
                    }}
                  >
                    <span className="ava" style={{ background: p.color }}>
                      {p.initials}
                    </span>
                    <span className="wi-meta">
                      <b>{p.first}</b>
                      <span>{p.role}</span>
                    </span>
                    {/* Savannah is on the board but has no login yet — say so
                        rather than implying she can sign in. */}
                    {!p.canSignIn && (
                      <span className="wi-tag" title="On the board, but no login yet">
                        no login
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
