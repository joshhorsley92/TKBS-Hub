'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/board';
import { SRC_COLOR, SRC_LABEL, daysUntil, dueText } from '@/lib/broadsheet';
import { Avatar } from '../primitives';
import { useWorkspace } from '../WorkspaceProvider';
import { useToast } from '../Toast';

// The 2-week look-ahead — a revolving 14-day sprint of small, checkable work.
//
// The window is derived from each task's due date (today → +14d), so it rolls
// forward on its own; nobody resets it. Completing a task fades it out and
// removes it: the board shows open work only, never a strikethrough graveyard.
export function LookAhead({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const { me, people, peopleById, profile } = useWorkspace();
  const toast = useToast();
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());

  async function complete(id: string, title: string) {
    setRemoving((r) => ({ ...r, [id]: true }));
    // Let the collapse animation play, then drop it and re-sync.
    setTimeout(() => setGone((g) => new Set(g).add(id)), 320);

    const rollback = () => {
      // If the write failed the task is still open. Pretending otherwise is a
      // lie the next reload would expose anyway — so put it back and say so.
      setRemoving((r) => ({ ...r, [id]: false }));
      setGone((g) => {
        const next = new Set(g);
        next.delete(id);
        return next;
      });
      toast('Couldn’t complete that — it’s still on the board');
    };

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      if (!res.ok) return rollback();
      toast(`Done · ${title}`);
      router.refresh();
    } catch {
      rollback();
    }
  }

  const window = tasks.filter((t) => !gone.has(t.id) && daysUntil(t.dueOn) <= 13);
  const visible = profile.ownerFilter === 'me' ? window.filter((t) => peopleById[t.profileId]?.key === me) : window;

  const byDue = (a: Task, b: Task) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime();
  const thisWeek = visible.filter((t) => daysUntil(t.dueOn) <= 6).sort(byDue);
  const nextWeek = visible.filter((t) => daysUntil(t.dueOn) >= 7).sort(byDue);

  const href = (t: Task) =>
    t.ventureId ? `/builds/${t.ventureId}` : t.clientId ? `/clients/${t.clientId}` : null;

  const rows = (items: Task[]) =>
    items.length ? (
      items.map((t) => {
        const owner = peopleById[t.profileId];
        const link = href(t);
        const late = daysUntil(t.dueOn) < 0;
        return (
          <div key={t.id} className={`la-tk${removing[t.id] ? ' rm' : ''}`}>
            <button
              className="la-cb"
              aria-label={`Mark done: ${t.title}`}
              title="Mark done — clears it from the board"
              onClick={() => void complete(t.id, t.title)}
            />
            {link ? (
              <Link href={link} className="la-tt">
                {t.title}
              </Link>
            ) : (
              <span className="la-tt">{t.title}</span>
            )}
            <span
              className="la-sd"
              style={{ background: SRC_COLOR[t.src] }}
              title={SRC_LABEL[t.src]}
              aria-hidden
            />
            <Avatar person={owner} />
            {/* Overdue is red AND says "late" — colour is never the only signal. */}
            <span className={`la-due${late ? ' warn' : ''}`}>{dueText(t.dueOn)}</span>
          </div>
        );
      })
    ) : (
      <div className="la-empty">Nothing queued — clear runway.</div>
    );

  return (
    <div>
      <div className="shead">
        <h3>2-week look-ahead</h3>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--ink-4)',
          }}
        >
          Auto-updated · rolls forward daily
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="es-t">No dated work queued.</div>
          <div className="es-s">
            The look-ahead is built from work items that have a due date. Add one from a client or a
            build, or ask Claude to queue it. Google Calendar isn’t connected yet — when it is, events
            land here automatically.
          </div>
        </div>
      ) : (
        <div className="la-cols">
          <div className="la-col">
            <div className="la-ch">
              <b>This week</b>
              <span className="n">
                {thisWeek.length} task{thisWeek.length === 1 ? '' : 's'}
              </span>
            </div>
            {rows(thisWeek)}
          </div>
          <div className="la-col">
            <div className="la-ch">
              <b>Next week</b>
              <span className="n">
                {nextWeek.length} task{nextWeek.length === 1 ? '' : 's'}
              </span>
            </div>
            {rows(nextWeek)}
          </div>
        </div>
      )}
    </div>
  );
}
