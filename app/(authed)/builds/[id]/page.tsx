import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBuild, getInitiatives, getPeople, getSignals } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import {
  BUILD_KIND_COLOR,
  BUILD_KIND_LABEL,
  DASH,
  SRC_COLOR,
  SRC_LABEL,
  fmt,
  fmtY,
  num,
} from '@/lib/broadsheet';
import { Avatar, Chip, EmptyState, Progress, SHead } from '@/components/broadsheet/primitives';
import {
  EngHoursControl,
  LinkClientControl,
  LinkRepoControl,
  type DeploymentLink,
} from '@/components/broadsheet/builds/BuildControls';

export const dynamic = 'force-dynamic';

// One build: what it cost, who it serves, and what's moving on it.
//
// The reuse map is the signature visual — the core is the build, each arm is a
// client it reaches. On day one there are no arms, because build_deployments is
// empty. That's the honest picture, and the empty state says so and hands you
// the control that fills it in.
export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [build, people, initiatives, signals, clients, repos] = await Promise.all([
    getBuild(id),
    getPeople(),
    getInitiatives(),
    getSignals(200),
    safeQuery<{ id: string; name: string }[]>((s) => s.from('clients').select('id, name').order('name')),
    safeQuery<{ id: string; name: string; org: string; venture_id: string | null }[]>((s) =>
      s.from('repos').select('id, name, org, venture_id').eq('is_active', true).order('name'),
    ),
  ]);
  if (!build) notFound();

  const kindColor = BUILD_KIND_COLOR[build.kind] ?? 'var(--ink-4)';
  const repoIds = new Set(build.repos.map((r) => r.id));
  const activity = signals.filter((s) => s.repoId && repoIds.has(s.repoId)).slice(0, 25);
  const linkedInits = initiatives.filter((i) => i.ventureId === build.id);

  // Ventures have no owner column. The only defensible owner is the person who
  // owns the work pointed at this build — and only when they all agree. Any
  // ambiguity and the stamp shows nothing rather than picking one.
  const owners = new Set(linkedInits.map((i) => i.ownerId));
  const owner = owners.size === 1 && people ? people.byId[[...owners][0]!] : null;

  const links: DeploymentLink[] = [
    ...build.deployed.map((d) => ({ clientId: d.clientId, clientName: d.clientName, status: 'deployed' as const })),
    ...build.candidates.map((c) => ({ clientId: c.clientId, clientName: c.clientName, status: 'candidate' as const })),
  ];
  const hasReuse = links.length > 0;
  const availableRepos = (repos ?? []).filter((r) => !r.venture_id);

  const clientControl = (
    <LinkClientControl
      ventureId={build.id}
      clients={clients ?? []}
      links={links}
      label={hasReuse ? '+ Link another client' : '+ Link a client'}
    />
  );

  return (
    <>
      <Link href="/builds" className="backlink">
        ← Builds
      </Link>

      <div className="topline">
        <div>
          <div className="kicker">
            <span
              className="bd-dot"
              style={{ background: kindColor, display: 'inline-block', marginRight: 7 }}
            />
            {BUILD_KIND_LABEL[build.kind] ?? build.kind}
            {build.repos.length > 0 && ` · ${build.repos.map((r) => r.name).join(' · ')}`}
          </div>
          <h1 className="h1" style={{ maxWidth: '18ch' }}>
            {build.name}
          </h1>
          {/* No blurb → no sub. Nothing is written on the build's behalf. */}
          {build.blurb && <p className="sub">{build.blurb}</p>}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Chip tone={build.status === 'launched' ? 'mint' : build.status === 'building' ? 'amber' : ''}>
              {build.status}
            </Chip>
          </div>
        </div>

        <div className="stamp">
          <div
            style={{
              fontFamily: 'var(--disp)',
              fontWeight: 700,
              fontSize: 22,
              color: build.engHours == null ? 'var(--ink-4)' : 'var(--ink)',
            }}
            title="Hand-entered. The hub has no source for engineering hours — it will not estimate one."
          >
            {build.engHours == null ? DASH : `${num(build.engHours)}h`}
          </div>
          <div style={{ marginTop: 4 }}>engineering · hand-entered</div>
          <EngHoursControl ventureId={build.id} engHours={build.engHours} blurb={build.blurb} />
          {owner && (
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <Avatar person={owner} />
            </div>
          )}
        </div>
      </div>

      {/* ── reuse map ─────────────────────────────────────────────────────── */}
      <div className="card pad" style={{ marginTop: 4 }}>
        <div className="eyebrow">Reuse map — build once, deploy many</div>

        {hasReuse ? (
          <>
            <div className="reusemap">
              <div className="rm-core">
                <span className="bd-dot" style={{ background: kindColor }} />
                <b>{build.name}</b>
                <small>
                  {build.repos.length ? build.repos.map((r) => r.name).join(' · ') : 'no repo mapped'}
                </small>
              </div>
              <div className="rm-arms">
                {build.deployed.map((d) => (
                  <Link
                    key={d.clientId}
                    href={`/clients/${d.clientId}`}
                    className="rm-arm"
                    style={{ color: 'inherit' }}
                  >
                    <span className="rm-line" />
                    <div className="rm-node deployed">
                      {d.clientName}
                      <small>
                        {[d.role ?? 'deployed', d.since ? fmt(d.since) : null].filter(Boolean).join(' · ')}
                      </small>
                    </div>
                  </Link>
                ))}
                {build.candidates.map((c) => (
                  <Link
                    key={c.clientId}
                    href={`/clients/${c.clientId}`}
                    className="rm-arm"
                    style={{ color: 'inherit' }}
                  >
                    <span className="rm-line dashed" />
                    <div className="rm-node cand">
                      {c.clientName}
                      <small>candidate</small>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 18 }}>{clientControl}</div>
          </>
        ) : (
          <div style={{ marginTop: 14 }}>
            <EmptyState title="Not deployed to a client yet." action={clientControl}>
              The map draws itself from <code>build_deployments</code>: every client this build serves
              becomes an arm off the core — solid when it&rsquo;s live, dashed when it&rsquo;s a
              candidate. There are no rows yet, so there are no arms. That&rsquo;s the point of the
              board: the hours are spent once, and this is where they start paying back.
            </EmptyState>
          </div>
        )}
      </div>

      {/* ── activity + initiatives ────────────────────────────────────────── */}
      <div className="grid2" style={{ marginTop: 26, alignItems: 'start' }}>
        <div>
          <SHead
            title="Repo activity"
            style={{ margin: '0 0 12px' }}
            right={
              <LinkRepoControl
                ventureId={build.id}
                linked={build.repos}
                available={availableRepos}
                label={build.repos.length ? 'Repos' : '+ Link a repo'}
              />
            }
          />
          <div className="card pad">
            {build.repos.length === 0 ? (
              <EmptyState title="No repo is mapped to this build.">
                Commits are ingested from GitHub already — they just aren&rsquo;t attributed to
                anything. Map a repo and its real commit history becomes this build&rsquo;s activity.
              </EmptyState>
            ) : activity.length === 0 ? (
              <div className="empty-inline">
                {build.repos.map((r) => r.name).join(' · ')} — mapped, but no commits have been
                ingested yet.
              </div>
            ) : (
              <div className="river">
                {activity.map((s) => (
                  <Link
                    key={s.id}
                    href={`/repos/${s.repoId}`}
                    className="ev"
                    style={{ color: 'inherit' }}
                  >
                    <span className="node2" style={{ background: SRC_COLOR[s.src] }} />
                    <span className="t">{fmtY(s.at)}</span>
                    <div className="body">
                      <b>{s.title}</b>
                      <div className="meta">
                        <span className="chip" style={{ color: SRC_COLOR[s.src] }}>
                          {SRC_LABEL[s.src]}
                        </span>
                        {s.repoName && <span className="sample">{s.repoName}</span>}
                        {s.actorId && people && <Avatar person={people.byId[s.actorId]} />}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SHead title="Linked initiatives" style={{ margin: '0 0 12px' }} />
          <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {linkedInits.length === 0 ? (
              <div className="empty-inline">
                No initiative points at this build. Link one from its page to have the work show up
                here.
              </div>
            ) : (
              linkedInits.map((i) => (
                <Link key={i.id} href={`/initiatives/${i.id}`} className="linkcard" style={{ color: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <b style={{ fontFamily: 'var(--disp)', fontSize: 13.5 }}>{i.title}</b>
                    {people && <Avatar person={people.byId[i.ownerId]} />}
                  </div>
                  <Progress value={i.progress} health={i.health} style={{ marginTop: 8 }} />
                  <div className="smol" style={{ marginTop: 6 }}>
                    {i.status} · {Math.round(i.progress * 100)}%
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
