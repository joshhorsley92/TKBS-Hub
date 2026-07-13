'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { PEOPLE_ORDER, type Person, type PersonKey } from '@/lib/broadsheet';
import {
  DEFAULT_PROFILES,
  PAGE_HREF,
  type WorkspaceProfile,
  themeVars,
  DENSITY,
} from '@/lib/workspace';
import { Rail } from './Rail';
import { CustomizeDrawer } from './CustomizeDrawer';
import { AskClaude, type Destination } from './AskClaude';
import { ToastProvider } from './Toast';

// Which person's workspace is on screen. Both founders have full access to all
// data — this only decides whose *presentation* (theme, nav, focus) is applied.
// Writes are still attributed to the authenticated user by the API layer.
const ME_KEY = 'tkbs_me_v1';

type Ctx = {
  me: PersonKey;
  person: Person;
  /** Everyone else on the board, in reading order. */
  others: Person[];
  /** Everyone, in reading order — for owner pickers and person filters. */
  roster: Person[];
  people: Partial<Record<PersonKey, Person>>;
  peopleById: Record<string, Person>;
  profile: WorkspaceProfile;
  /** Real board records (clients, builds, initiatives) for ⌘K jump-to. */
  destinations: Destination[];
  editing: boolean;
  setEditing: (v: boolean) => void;
  toggleEditing: () => void;
  switchMe: (who: PersonKey) => void;
  patch: (fn: (p: WorkspaceProfile) => WorkspaceProfile) => void;
  reset: () => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return c;
}

export function WorkspaceProvider({
  people,
  peopleById,
  initial,
  destinations,
  children,
}: {
  people: Partial<Record<PersonKey, Person>>;
  peopleById: Record<string, Person>;
  initial: Partial<Record<PersonKey, WorkspaceProfile>>;
  destinations: Destination[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initial);
  const [me, setMe] = useState<PersonKey>('joe');
  const [editing, setEditing] = useState(false);

  // Restore the last-viewed person after hydration, so SSR and the first client
  // render agree (avoids a hydration mismatch on the themed shell).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ME_KEY) as PersonKey | null;
      // Only restore a seat that actually exists — a stale 'savannah' from
      // before her profile existed must not wedge the console.
      if (saved && people[saved]) setMe(saved);
    } catch {
      /* no localStorage — stay on the default */
    }
  }, [people]);

  const persist = useCallback(
    (who: PersonKey, next: WorkspaceProfile) => {
      const profileId = people[who]?.id;
      if (!profileId) return;
      void fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId, prefs: next }),
      }).catch(() => {
        /* the workspace is cosmetic — a failed save must never break the board */
      });
    },
    [people],
  );

  const patch = useCallback(
    (fn: (p: WorkspaceProfile) => WorkspaceProfile) => {
      setProfiles((prev) => {
        const current = prev[me];
        if (!current) return prev;
        const next = fn(current);
        persist(me, next);
        return { ...prev, [me]: next };
      });
    },
    [me, persist],
  );

  const reset = useCallback(() => {
    const def = JSON.parse(JSON.stringify(DEFAULT_PROFILES[me])) as WorkspaceProfile;
    setProfiles((prev) => ({ ...prev, [me]: def }));
    persist(me, def);
  }, [me, persist]);

  const switchMe = useCallback(
    (who: PersonKey) => {
      if (!people[who]) return;
      setMe(who);
      try {
        localStorage.setItem(ME_KEY, who);
      } catch {
        /* ignore */
      }
      // Land on that person's home page — Savannah opens on Money, not Pulse.
      const p = profiles[who] ?? DEFAULT_PROFILES[who];
      const landing = p.nav.includes(p.landing) ? p.landing : 'pulse';
      router.push(PAGE_HREF[landing]);
    },
    [people, profiles, router],
  );

  const profile = profiles[me] ?? DEFAULT_PROFILES[me];
  const roster = PEOPLE_ORDER.map((k) => people[k]).filter((p): p is Person => Boolean(p));

  const value = useMemo<Ctx>(
    () => ({
      me,
      person: people[me]!,
      others: roster.filter((p) => p.key !== me),
      roster,
      people,
      peopleById,
      profile,
      destinations,
      editing,
      setEditing,
      toggleEditing: () => setEditing((e) => !e),
      switchMe,
      patch,
      reset,
    }),
    [me, people, roster, peopleById, profile, destinations, editing, switchMe, patch, reset],
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

/**
 * The themed shell: sidebar + scrolling content well.
 *
 * Accent, display font and density are all CSS-variable / inline-style swaps,
 * so switching person re-skins the entire console without re-fetching anything.
 * `children` are server-rendered pages passed straight through.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { profile } = useWorkspace();
  const dens = DENSITY[profile.theme.density] ?? DENSITY.regular;

  return (
    <ToastProvider>
      <div className="app" style={themeVars(profile)}>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <Rail />
        <main id="main" className="main" style={{ fontSize: dens.fs }} tabIndex={-1}>
          <div className="wrap" style={{ padding: dens.wrap }}>
            {children}
          </div>
        </main>
        <CustomizeDrawer />
        <AskClaude />
      </div>
    </ToastProvider>
  );
}
