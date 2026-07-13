'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Signal } from '@/lib/board';
import { SRC_COLOR, SRC_LABEL, SRC_LEGEND, fmt, tme } from '@/lib/broadsheet';
import { Avatar } from '../primitives';
import { useWorkspace } from '../WorkspaceProvider';

// Live signals — the real activity river.
//
// The prototype invented an event every 5s to look alive. This polls the actual
// work_log every 25s. If nothing shipped, nothing appears: an idle board is a
// truthful board. The "new" badge and shimmer only fire on rows that genuinely
// arrived since the last poll.
const POLL_MS = 25_000;

export function LiveSignals({ initial }: { initial: Signal[] }) {
  const { peopleById } = useWorkspace();
  const [rows, setRows] = useState<Signal[]>(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [shimmer, setShimmer] = useState(false);
  const seen = useRef<Set<string>>(new Set(initial.map((s) => s.id)));

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch('/api/signals?limit=8', { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (!alive || !Array.isArray(body.signals)) return;

        const incoming: Signal[] = body.signals;
        const added = incoming.filter((s) => !seen.current.has(s.id));
        if (!added.length) return;

        added.forEach((s) => seen.current.add(s.id));
        setFresh(new Set(added.map((s) => s.id)));
        setRows(incoming);
        setShimmer(true);
        setTimeout(() => alive && setShimmer(false), 1100);
        setTimeout(() => alive && setFresh(new Set()), 6000);
      } catch {
        /* a failed poll is not an event — leave the river as it is */
      }
    };

    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <div className="shead">
        <h3>Live signals</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syncbar">
            <span className="s" />
            LIVE · GITHUB
          </span>
          <Link href="/timeline" className="tog">
            Timeline →
          </Link>
        </div>
      </div>

      <div className="siglegend">
        {SRC_LEGEND.map(([k, label]) => (
          <span key={k} className="lg">
            <span className="lgd" style={{ background: SRC_COLOR[k] }} />
            {label}
          </span>
        ))}
      </div>

      <div className={`card pad shimmer${shimmer ? ' on' : ''}`}>
        {rows.length === 0 ? (
          <div className="empty-inline">
            No activity recorded yet. Commits appear here as soon as GitHub sync runs.
          </div>
        ) : (
          <div className="river">
            {rows.map((s) => (
              <div key={s.id} className={`ev${fresh.has(s.id) ? ' fresh' : ''}`}>
                <span className="node2" style={{ background: SRC_COLOR[s.src] }} />
                <span className="t">
                  {fmt(s.at)} · {tme(s.at)}
                </span>
                <div className="body">
                  <b>{s.title}</b>
                  <div className="meta">
                    <span className="chip" style={{ color: SRC_COLOR[s.src] }}>
                      {SRC_LABEL[s.src]}
                    </span>
                    {s.actorId && <Avatar person={peopleById[s.actorId]} />}
                    {s.repoName && (
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                        {s.repoName}
                      </span>
                    )}
                    {s.clientName && (
                      <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{s.clientName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
