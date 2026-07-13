import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBuild, getInitiative, getPeople, getSignals } from '@/lib/board';
import { SRC_COLOR, SRC_LABEL, ago, fmtY } from '@/lib/broadsheet';
import { Avatar, Chip, Progress } from '@/components/broadsheet/primitives';
import {
  DecisionLogForm,
  InitiativeControls,
} from '@/components/broadsheet/initiatives/InitiativeForms';

export const dynamic = 'force-dynamic';

const laneTone = (lane: string) =>
  lane === 'Product' ? 'violet' : lane === 'Client' ? 'blue' : lane === 'Service' ? 'mint' : '';

export default async function InitiativeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [initiative, people] = await Promise.all([getInitiative(id), getPeople()]);
  if (!initiative) notFound();

  const build = initiative.ventureId ? await getBuild(initiative.ventureId) : null;

  // Everything this initiative touches, as it actually happened.
  const all = await getSignals(200);
  const linked = all
    .filter(
      (s) =>
        (initiative.repoId && s.repoId === initiative.repoId) ||
        (initiative.clientId && s.clientId === initiative.clientId),
    )
    .slice(0, 8);

  const owner = people?.byId[initiative.ownerId];
  const blocker = initiative.blockedOnExternal
    ? 'the client'
    : initiative.blockedOnProfileId
      ? (people?.byId[initiative.blockedOnProfileId]?.first ?? 'someone')
      : null;

  return (
    <>
      <Link href="/initiatives" className="backlink">
        ← Initiatives
      </Link>

      <div className="topline">
        <div>
          <div className="kicker">
            <Chip tone={laneTone(initiative.lane) as 'violet' | 'blue' | 'mint' | ''}>
              {initiative.lane}
            </Chip>
            <span style={{ marginLeft: 8 }} className="stat">
              {initiative.status}
            </span>
          </div>
          <h1 className="h1" style={{ maxWidth: '18ch' }}>
            {initiative.title}
          </h1>
          {initiative.why && <p className="sub">{initiative.why}</p>}
        </div>
        <div className="stamp">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Avatar person={owner} />
          </div>
          <div>owner · {owner?.first ?? '—'}</div>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 4, marginBottom: 8 }}>
        <div className="card pad">
          <div className="eyebrow">Progress · hand-set</div>
          <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 26, marginTop: 6 }}>
            {Math.round(initiative.progress * 100)}%
          </div>
          <Progress value={initiative.progress} health={initiative.health} style={{ marginTop: 8 }} />
        </div>

        <div className="card pad">
          <div className="eyebrow">Status</div>
          {blocker ? (
            <>
              <div style={{ marginTop: 8 }}>
                <Chip tone="amber">
                  <span className="pd" />
                  Blocked on {blocker}
                </Chip>
              </div>
              {initiative.blockNote && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>{initiative.blockNote}</p>
              )}
            </>
          ) : (
            <div style={{ marginTop: 8 }}>
              <Chip tone="mint">
                <span className="pd" />
                Clear — no blockers
              </Chip>
            </div>
          )}
        </div>

        <div className="card pad">
          <div className="eyebrow">Latest signal · auto</div>
          {initiative.signal ? (
            <>
              <div className="signal" style={{ marginTop: 10 }}>
                <span className="src">{SRC_LABEL[initiative.signal.src]}</span>
              </div>
              <p style={{ fontSize: 13, marginTop: 6 }}>{initiative.signal.title}</p>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                {ago(initiative.signal.at)}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 10 }}>
              Nothing yet. Link a repo or a client and their activity becomes this initiative’s status —
              no manual updates.
            </p>
          )}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div>
          <div className="shead" style={{ margin: '0 0 12px' }}>
            <h3>Decisions log</h3>
          </div>
          <div className="card pad">
            <DecisionLogForm initiativeId={initiative.id} />
            <div className="river" style={{ marginTop: 16 }}>
              {initiative.decisions.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 12.5, paddingLeft: 4 }}>
                  No decisions logged yet. Most status here is derived automatically — only log the
                  calls you actually make.
                </div>
              ) : (
                initiative.decisions.map((d) => (
                  <div key={d.id} className="ev">
                    <span className="node2" style={{ background: 'var(--ink)' }} />
                    <span className="t">{fmtY(d.at)}</span>
                    <div className="body">
                      <b>{d.body}</b>
                      <div className="meta">
                        <Avatar person={d.actorId ? people?.byId[d.actorId] : null} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="shead" style={{ margin: '22px 0 12px' }}>
            <h3>Linked signals</h3>
          </div>
          <div className="card pad">
            <div className="river">
              {linked.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>No linked signals yet.</div>
              ) : (
                linked.map((s) => (
                  <div key={s.id} className="ev">
                    <span className="node2" style={{ background: SRC_COLOR[s.src] }} />
                    <span className="t">{fmtY(s.at)}</span>
                    <div className="body">
                      <b>{s.title}</b>
                      <div className="meta">
                        <span className="chip" style={{ color: SRC_COLOR[s.src] }}>
                          {SRC_LABEL[s.src]}
                        </span>
                        <Avatar person={s.actorId ? people?.byId[s.actorId] : null} />
                        {s.repoName && (
                          <span
                            style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}
                          >
                            {s.repoName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="shead" style={{ margin: '0 0 12px' }}>
            <h3>Connected</h3>
          </div>
          <div className="card pad">
            <div className="eyebrow">Internal build</div>
            {build ? (
              <Link href={`/builds/${build.id}`} className="linkcard" style={{ marginTop: 8 }}>
                <b style={{ fontFamily: 'var(--disp)', fontSize: 14 }}>{build.name}</b>
                {build.blurb && (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>{build.blurb}</p>
                )}
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 7 }}>
                  Deployed to {build.deployed.length} client{build.deployed.length === 1 ? '' : 's'}
                </div>
              </Link>
            ) : (
              <div style={{ color: 'var(--ink-4)', fontSize: 12.5, marginTop: 8 }}>No build linked</div>
            )}

            <hr className="rule" style={{ margin: '16px 0' }} />
            <div className="eyebrow">Client</div>
            {initiative.clientId ? (
              <Link href={`/clients/${initiative.clientId}`} className="linkcard" style={{ marginTop: 8 }}>
                <b style={{ fontFamily: 'var(--disp)', fontSize: 14 }}>{initiative.clientName}</b>
              </Link>
            ) : (
              <div style={{ color: 'var(--ink-4)', fontSize: 12.5, marginTop: 8 }}>
                Internal — no client
              </div>
            )}

            <hr className="rule" style={{ margin: '16px 0' }} />
            <div className="eyebrow">Repo</div>
            {initiative.repoId ? (
              <Link
                href={`/repos/${initiative.repoId}`}
                style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8, display: 'block' }}
              >
                {initiative.repoName}
              </Link>
            ) : (
              <div style={{ color: 'var(--ink-4)', fontSize: 12.5, marginTop: 8 }}>None linked</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <InitiativeControls initiative={initiative} />
          </div>
        </div>
      </div>
    </>
  );
}
