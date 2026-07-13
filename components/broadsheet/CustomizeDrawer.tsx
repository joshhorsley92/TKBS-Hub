'use client';

import { useState } from 'react';
import { I } from './icons';
import { SignOutButton } from '../SignOutButton';
import { useWorkspace } from './WorkspaceProvider';
import {
  ACCENTS,
  ALL_PAGES,
  ALL_PULSE,
  PAGE_LABEL,
  PULSE_LABEL,
  type Accent,
  type Density,
  type DisplayFont,
  type PageKey,
} from '@/lib/workspace';

/** Minimal HTML5 drag-to-reorder over a list of string ids. */
export function useDnD<T extends string>(order: T[], onReorder: (next: T[]) => void) {
  const [drag, setDrag] = useState<T | null>(null);
  const [over, setOver] = useState<T | null>(null);

  const handlers = (id: T) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDrag(id);
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      } catch {
        /* Safari can throw here; the drag still works */
      }
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== id) setOver(id);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (drag && drag !== id) {
        const next = [...order];
        const [moved] = next.splice(next.indexOf(drag), 1);
        next.splice(next.indexOf(id), 0, moved!);
        onReorder(next);
      }
      setDrag(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDrag(null);
      setOver(null);
    },
    dragging: drag === id,
    isOver: over === id && drag !== id,
  });

  return { handlers };
}

const FONTS: DisplayFont[] = ['Outfit', 'Space Grotesk', 'Newsreader'];
const DENSITIES: Density[] = ['compact', 'regular', 'comfy'];

export function CustomizeDrawer() {
  const { me, person, other, profile, editing, setEditing, patch, reset, switchMe } = useWorkspace();
  const [confirmReset, setConfirmReset] = useState(false);

  const setTheme = <K extends keyof typeof profile.theme>(k: K, v: (typeof profile.theme)[K]) =>
    patch((p) => ({ ...p, theme: { ...p.theme, [k]: v } }));

  const navOrder = profile.nav;
  const hiddenPages = ALL_PAGES.filter((k) => !navOrder.includes(k));
  const { handlers } = useDnD<PageKey>(navOrder, (next) => patch((p) => ({ ...p, nav: next })));

  if (!editing) return null;

  return (
    <>
      <div className="dw-scrim" onClick={() => setEditing(false)} />
      <div className="drawer">
        <div className="dw-head">
          <span className="ava" style={{ background: person.color }}>
            {person.initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <b>{person.first}’s workspace</b>
            <span className="rl">{person.role} · saved to your account</span>
          </div>
          <button className="x" aria-label="Close workspace panel" onClick={() => setEditing(false)}>
            ✕
          </button>
        </div>

        <div className="dw-body">
          <div className="dw-sect">Accent</div>
          <div className="sw-row">
            {(Object.keys(ACCENTS) as Accent[]).map((k) => (
              <button
                key={k}
                className={`sw${profile.theme.accent === k ? ' on' : ''}`}
                style={{ background: ACCENTS[k].bright }}
                title={ACCENTS[k].name}
                aria-label={`Accent: ${ACCENTS[k].name}`}
                aria-pressed={profile.theme.accent === k}
                onClick={() => setTheme('accent', k)}
              />
            ))}
          </div>

          <div className="dw-sect">Display font</div>
          <div className="r" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FONTS.map((f) => (
              <button
                key={f}
                className={`tog${profile.theme.font === f ? ' on' : ''}`}
                onClick={() => setTheme('font', f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="dw-sect">Density</div>
          <div className="r" style={{ display: 'flex', gap: 6 }}>
            {DENSITIES.map((d) => (
              <button
                key={d}
                className={`tog${profile.theme.density === d ? ' on' : ''}`}
                onClick={() => setTheme('density', d)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="dw-note" style={{ marginTop: 8 }}>
            Compact turns the daily digest into a two-line highlights brief.
          </p>

          <div className="dw-sect">Pulse focus</div>
          <div className="r" style={{ display: 'flex', gap: 6 }}>
            {(
              [
                ['me', 'Just me'],
                ['all', 'Everyone'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                className={`tog${profile.ownerFilter === v ? ' on' : ''}`}
                onClick={() => patch((p) => ({ ...p, ownerFilter: v }))}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="dw-sect">Pages &amp; landing</div>
          <p className="dw-note">
            Drag to reorder the sidebar. Choose which page opens first for {person.first}.
          </p>
          <div className="dw-pages">
            {navOrder.map((k) => {
              const h = handlers(k);
              const isLanding = profile.landing === k;
              const { dragging, isOver, ...dnd } = h;
              return (
                <div
                  key={k}
                  className={`pgrow${dragging ? ' drag' : ''}${isOver ? ' over' : ''}`}
                  {...dnd}
                >
                  <span className="grip">
                    <I.grip width="16" height="16" />
                  </span>
                  <span className="nm">{PAGE_LABEL[k]}</span>
                  {isLanding ? (
                    <span className="land">Opens first</span>
                  ) : (
                    <button
                      className="setland"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        patch((p) => ({ ...p, landing: k }));
                      }}
                    >
                      Set as home
                    </button>
                  )}
                  {/* Pulse is the home surface and can't be hidden. */}
                  {k !== 'pulse' && (
                    <button
                      className="eye"
                      aria-label={`Hide ${PAGE_LABEL[k]} from the sidebar`}
                      title="Hide page"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        patch((p) => ({
                          ...p,
                          nav: p.nav.filter((x) => x !== k),
                          landing: p.landing === k ? 'pulse' : p.landing,
                        }));
                      }}
                    >
                      <I.eyeoff width="15" height="15" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {hiddenPages.length > 0 && (
            <>
              <div className="dw-note" style={{ margin: '12px 0 8px' }}>
                Hidden pages · tap to add back
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hiddenPages.map((k) => (
                  <button
                    key={k}
                    className="modchip"
                    onClick={() => patch((p) => ({ ...p, nav: [...p.nav, k] }))}
                  >
                    <span className="pl">+</span>
                    {PAGE_LABEL[k]}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="dw-sect">Pulse cards</div>
          <p className="dw-note">
            Toggle which cards appear on {person.first}’s Pulse. Drag them on the page to reorder.
          </p>
          <div className="dw-pages">
            {ALL_PULSE.map((k) => {
              const on = profile.pulse.includes(k);
              return (
                <div key={k} className={`pgrow${on ? '' : ' off'}`} style={{ cursor: 'default' }}>
                  <span className="nm">{PULSE_LABEL[k]}</span>
                  <button
                    className="eye"
                    aria-label={`${on ? 'Hide' : 'Show'} the ${PULSE_LABEL[k]} card`}
                    aria-pressed={on}
                    title={on ? 'Hide card' : 'Show card'}
                    onClick={() =>
                      patch((p) => ({
                        ...p,
                        pulse: on ? p.pulse.filter((x) => x !== k) : [...p.pulse, k],
                      }))
                    }
                  >
                    {on ? <I.eye width="15" height="15" /> : <I.eyeoff width="15" height="15" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dw-foot">
          <button className="btn ghost sm" onClick={() => switchMe(other.key)}>
            Switch to {other.first}
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              if (confirmReset) {
                reset();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 4000);
              }
            }}
          >
            {confirmReset ? 'Sure?' : 'Reset'}
          </button>
          <span style={{ marginLeft: 'auto' }}>
            <SignOutButton />
          </span>
        </div>
      </div>
    </>
  );
}
