import Link from 'next/link';
import { getBuilds, getInitiatives, getPeople } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import { SRC_LABEL, ago } from '@/lib/broadsheet';
import { Avatar, Chip, EmptyState, Progress } from '@/components/broadsheet/primitives';
import { NewInitiativeButton } from '@/components/broadsheet/initiatives/InitiativeForms';

export const dynamic = 'force-dynamic';

const LANES = ['all', 'Client', 'Product', 'Service', 'Ops'];

// Initiatives — the one hand-kept surface.
//
// Deliberately NOT derived from repo activity: this is the layer of judgement
// above the signal. What the board does derive is each initiative's *latest
// signal* (the most recent real commit on its linked repo), so nobody has to
// write a status update.
const STATUS_ORDER: Record<string, number> = {
  active: 0,
  evaluating: 1,
  idea: 2,
  paused: 3,
  shipped: 4,
};

const laneTone = (lane: string) =>
  lane === 'Product' ? 'violet' : lane === 'Client' ? 'blue' : lane === 'Service' ? 'mint' : '';

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  const { lane: laneParam } = await searchParams;
  const lane = LANES.includes(laneParam ?? '') ? laneParam! : 'all';

  const [initiatives, people, builds, clients, repos] = await Promise.all([
    getInitiatives(),
    getPeople(),
    getBuilds(),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('clients').select('id, name').order('name')),
    safeQuery<{ id: string; name: string }[]>((s) =>
      s.from('repos').select('id, name').eq('is_active', true).order('name'),
    ),
  ]);

  const list = initiatives
    .filter((i) => lane === 'all' || i.lane === lane)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  const options = {
    clients: clients ?? [],
    builds: builds.map((b) => ({ id: b.id, name: b.name })),
    repos: repos ?? [],
  };

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Initiatives</h1>
        </div>
        <NewInitiativeButton {...options} />
      </div>

      {initiatives.length === 0 ? (
        <EmptyState title="No initiatives yet.">
          An initiative is a bet you’re choosing to make — “ship Seasonal Stylist”, “unblock the Astro
          Paws creatives”. The hub keeps them by hand on purpose: everything else on this board is
          derived from GitHub and FreshBooks, but what’s <em>worth doing</em> is a judgement call.
          Link one to a repo and its commits become the initiative’s status automatically.
        </EmptyState>
      ) : (
        <>
          <div className="shead" style={{ marginTop: 6 }}>
            <h3>
              {list.length} in flight
              {lane !== 'all' && (
                <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 14 }}> · {lane}</span>
              )}
            </h3>
            <div className="r">
              {LANES.map((l) => (
                <Link
                  key={l}
                  href={l === 'all' ? '/initiatives' : `/initiatives?lane=${l}`}
                  className={`tog${lane === l ? ' on' : ''}`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>

          <div className="card pad init">
            {list.length === 0 ? (
              <div className="empty-inline">Nothing in the {lane} lane.</div>
            ) : (
              list.map((i) => {
                const blocker = i.blockedOnExternal
                  ? 'Client'
                  : i.blockedOnProfileId
                    ? (people?.byId[i.blockedOnProfileId]?.first ?? 'someone')
                    : null;

                return (
                  <Link key={i.id} href={`/initiatives/${i.id}`} className="initrow">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Chip tone={laneTone(i.lane) as 'violet' | 'blue' | 'mint' | ''}>{i.lane}</Chip>
                        <h4>{i.title}</h4>
                      </div>
                      {i.why && <div className="why">{i.why}</div>}

                      {/* The auto-signal: a real commit, not a status update. */}
                      {i.signal ? (
                        <div className="signal">
                          <span className="src">{SRC_LABEL[i.signal.src]}</span>
                          {i.signal.title}
                          <span style={{ color: 'var(--ink-4)' }}>· {ago(i.signal.at)}</span>
                        </div>
                      ) : (
                        <div className="signal">
                          <span style={{ color: 'var(--ink-4)' }}>
                            No signal — link a repo or client and activity shows up here.
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Progress value={i.progress} health={i.health} />
                      {blocker && (
                        <div style={{ marginTop: 9 }}>
                          <Chip tone="amber">
                            <span className="pd" />
                            Blocked · {blocker}
                          </Chip>
                        </div>
                      )}
                      {i.ventureName && (
                        <div style={{ marginTop: 9, fontSize: 11.5, color: 'var(--ink-4)' }}>
                          ◆ {i.ventureName}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="stat"
                        style={{
                          color:
                            i.status === 'active'
                              ? 'var(--mint-ink)'
                              : i.status === 'evaluating'
                                ? 'var(--violet)'
                                : 'var(--ink-4)',
                        }}
                      >
                        {i.status}
                      </span>
                      <div style={{ marginTop: 9, display: 'flex', justifyContent: 'flex-end' }}>
                        <Avatar person={people?.byId[i.ownerId]} />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
