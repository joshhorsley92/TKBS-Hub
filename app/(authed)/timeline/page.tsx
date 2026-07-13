import Link from 'next/link';
import { getPeople, getSignals, type Signal } from '@/lib/board';
import { SRC_COLOR, SRC_LABEL, fmtY, tme } from '@/lib/broadsheet';
import { Avatar, EmptyState } from '@/components/broadsheet/primitives';

export const dynamic = 'force-dynamic';

// Timeline — the whole activity river, every source, both people.
//
// The Pulse's Live signals card shows the last handful; this is the log itself.
// Filters live in the URL (?src=git&who=<profileId>) rather than in component
// state, which keeps the page a server component, makes a filtered view
// shareable, and means the DB does the filtering instead of the browser.
//
// Today the log is GitHub commits plus hand-logged Hub actions. The Calendar and
// FreshBooks lanes exist because the board speaks in five lanes — until those
// integrations are wired they filter to nothing, and an empty lane is the
// truthful rendering of "not connected yet".

const LIMIT = 200;

const SRC_TABS: [string, string][] = [
  ['all', 'All'],
  ['git', 'Git'],
  ['freshbooks', 'FreshBooks'],
  ['cal', 'Calendar'],
  ['hub', 'Hub'],
];

type Day = { day: string; rows: Signal[] };

/** Signals arrive newest-first, so a linear pass is enough to cut them into days. */
function byDay(rows: Signal[]): Day[] {
  const days: Day[] = [];
  for (const s of rows) {
    const day = fmtY(s.at);
    const last = days[days.length - 1];
    if (last?.day === day) last.rows.push(s);
    else days.push({ day, rows: [s] });
  }
  return days;
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; who?: string }>;
}) {
  const { src = 'all', who = 'all' } = await searchParams;

  const [people, signals, anyAtAll] = await Promise.all([
    getPeople(),
    getSignals(LIMIT, { src, who }),
    // One unfiltered row, purely to tell "the log is empty" apart from "your
    // filter matched nothing". Those are different facts and read differently.
    getSignals(1),
  ]);

  const href = (nextSrc: string, nextWho: string) => {
    const p = new URLSearchParams();
    if (nextSrc !== 'all') p.set('src', nextSrc);
    if (nextWho !== 'all') p.set('who', nextWho);
    const qs = p.toString();
    return qs ? `/timeline?${qs}` : '/timeline';
  };

  const days = byDay(signals);
  const logIsEmpty = anyAtAll.length === 0;

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Timeline</h1>
        </div>
      </div>

      <div className="shead" style={{ marginTop: 6 }}>
        <div className="r">
          {SRC_TABS.map(([key, label]) => (
            <Link key={key} href={href(key, who)} className={`tog${src === key ? ' on' : ''}`}>
              {label}
            </Link>
          ))}
        </div>
        {people && (
          <div className="r">
            <Link href={href(src, 'all')} className={`tog${who === 'all' ? ' on' : ''}`}>
              Everyone
            </Link>
            {people.list.map((p) => (
              <Link key={p.key} href={href(src, p.id)} className={`tog${who === p.id ? ' on' : ''}`}>
                {p.first}
              </Link>
            ))}
          </div>
        )}
      </div>

      {logIsEmpty ? (
        <EmptyState title="Nothing has been logged yet.">
          This is the raw work log: every GitHub commit, every money event, every action taken in the
          hub. It fills itself the moment a sync runs — it is empty because nothing has been
          recorded, not because nothing has been entered.
        </EmptyState>
      ) : (
        <div className="card pad">
          {days.map(({ day, rows }) => (
            <div key={day}>
              <div className="daybreak">{day}</div>
              <div className="river">
                {rows.map((s) => {
                  const person = s.actorId ? people?.byId[s.actorId] : null;
                  return (
                    <div key={s.id} className="ev">
                      <span className="node2" style={{ background: SRC_COLOR[s.src] }} />
                      <span className="t">{tme(s.at)}</span>
                      <div className="body">
                        <b>
                          {/* A commit points at the commit; anything else with a repo points at
                              the repo. Nothing points nowhere. */}
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'inherit' }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                          ) : s.repoId ? (
                            <Link href={`/repos/${s.repoId}`} style={{ color: 'inherit' }} title={s.title}>
                              {s.title}
                            </Link>
                          ) : (
                            s.title
                          )}
                        </b>
                        <div className="meta">
                          <span className="chip" style={{ color: SRC_COLOR[s.src] }}>
                            {SRC_LABEL[s.src]}
                          </span>
                          {person && <Avatar person={person} />}
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
                  );
                })}
              </div>
            </div>
          ))}

          {signals.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--ink-4)',
                padding: '30px 0',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
            >
              NOTHING MATCHES THIS FILTER
            </div>
          )}
        </div>
      )}
    </>
  );
}
