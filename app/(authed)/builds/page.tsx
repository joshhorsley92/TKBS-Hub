import Link from 'next/link';
import { getBuilds } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import { BUILD_KIND_COLOR, BUILD_KIND_LABEL, DASH, SRC_LABEL, ago, num } from '@/lib/broadsheet';
import { Chip, EmptyState, SHead } from '@/components/broadsheet/primitives';

export const dynamic = 'force-dynamic';

// Builds — the internal assets, and what each one is worth on reuse.
//
// A build is a venture: something we built once and can deploy many times. The
// board's whole thesis is on this page — cost is incurred once, value compounds
// per client it serves. Which means the two figures that matter (hours in,
// clients out) are exactly the two the hub can't yet measure for itself:
//
//   · eng_hours is hand-entered. GitHub knows commits, not hours. Null → "—".
//   · build_deployments starts empty. Zero deployments is a real, correct answer
//     on day one — not a rendering failure, and not something to pad.
//
// Everything below comes from the database or renders as unknown.

type RepoRow = {
  id: string;
  org: string;
  name: string;
  venture_id: string | null;
  last_commit_at: string | null;
  last_commit_message: string | null;
};

const STATUS_TONE: Record<string, 'mint' | 'amber' | 'blue' | 'violet' | ''> = {
  building: 'amber',
  exploring: 'violet',
  sunset: '',
};

export default async function BuildsPage() {
  const [builds, repos] = await Promise.all([
    getBuilds(),
    safeQuery<RepoRow[]>((s) =>
      s
        .from('repos')
        .select('id, org, name, venture_id, last_commit_at, last_commit_message')
        .eq('is_active', true)
        .order('last_commit_at', { ascending: false, nullsFirst: false }),
    ),
  ]);

  // Hours: sum only what a human actually recorded. If nobody has, the total is
  // unknown — never 0. If some have, say how many, so a partial total can't read
  // as a whole one.
  const withHours = builds.filter((b) => b.engHours != null);
  const totalHours = withHours.length
    ? withHours.reduce((s, b) => s + (b.engHours ?? 0), 0)
    : null;

  // Deployments: a genuine row count. Zero here means zero rows exist.
  const deployedCount = builds.reduce((s, b) => s + b.deployed.length, 0);
  const candidateCount = builds.reduce((s, b) => s + b.candidates.length, 0);

  const statusTally = Object.entries(
    builds.reduce<Record<string, number>>((acc, b) => {
      acc[b.status] = (acc[b.status] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([k, n]) => `${n} ${k}`)
    .join(' · ');

  const unlinkedRepos = (repos ?? []).filter((r) => !r.venture_id);

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Builds</h1>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 4, marginBottom: 8 }}>
        <div className="card pad">
          <div className="eyebrow">Builds</div>
          <div className="bignum">{num(builds.length)}</div>
          <div className="smol">{statusTally || 'none recorded'}</div>
        </div>

        <div className="card pad" title="Hand-entered on each build. The hub has no source for engineering hours — GitHub records commits, not time.">
          <div className="eyebrow">Eng. invested · hand-entered</div>
          <div className="bignum">
            {totalHours == null ? <span className="unk">{DASH}</span> : `${num(totalHours)}h`}
          </div>
          <div className="smol">
            {totalHours == null
              ? 'No hours recorded on any build. Unsourced — never estimated.'
              : `Entered on ${withHours.length} of ${builds.length} builds`}
          </div>
        </div>

        <div className="card pad">
          <div className="eyebrow">Client deployments</div>
          <div className="bignum">{num(deployedCount)}</div>
          <div className="smol">
            {deployedCount === 0
              ? candidateCount > 0
                ? `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} · none deployed yet`
                : 'No build is serving a client yet'
              : `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} · reuse compounding`}
          </div>
        </div>
      </div>

      {builds.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <EmptyState title="No builds on the board.">
            A build is a venture — something built once and deployed to many clients. This list is
            read straight from the <code>ventures</code> table; it&rsquo;s empty because the table is.
          </EmptyState>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {builds.map((b) => (
            <Link
              key={b.id}
              href={`/builds/${b.id}`}
              className="card buildcard"
              style={{ color: 'inherit' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    className="bd-dot"
                    style={{ background: BUILD_KIND_COLOR[b.kind] ?? 'var(--ink-4)' }}
                  />
                  <span className="bc-name">{b.name}</span>
                  <Chip>{BUILD_KIND_LABEL[b.kind] ?? b.kind}</Chip>
                  {b.status !== 'active' && b.status !== 'launched' && (
                    <Chip tone={STATUS_TONE[b.status] ?? ''}>{b.status}</Chip>
                  )}
                </div>

                {/* No blurb → no line. The card doesn't write one for it. */}
                {b.blurb && <p className="bc-blurb">{b.blurb}</p>}

                {b.signal ? (
                  <div className="signal">
                    <span className="src">{SRC_LABEL[b.signal.src]}</span>
                    {b.signal.title}
                    <span style={{ color: 'var(--ink-4)' }}>· {ago(b.signal.at)}</span>
                  </div>
                ) : (
                  <div className="signal">
                    <span style={{ color: 'var(--ink-4)' }}>
                      {b.repos.length
                        ? 'No commits ingested for this build’s repos yet'
                        : 'No repo mapped — commits can’t roll up here yet'}
                    </span>
                  </div>
                )}
              </div>

              <div className="bc-econ">
                <div
                  className="econ-h"
                  title="Hand-entered. There is no automatic source for engineering hours."
                >
                  <span className={b.engHours == null ? 'unk' : undefined}>
                    {b.engHours == null ? DASH : `${num(b.engHours)}h`}
                  </span>
                  <small>invested{b.engHours == null ? ' · unrecorded' : ''}</small>
                </div>
                <div className="reuse">
                  {b.deployed.map((d) => (
                    <span
                      key={d.clientId}
                      className="reuse-pill deployed"
                      title={d.role ? `${d.clientName} — ${d.role}` : d.clientName}
                    >
                      {d.clientName}
                    </span>
                  ))}
                  {b.candidates.map((c) => (
                    <span key={c.clientId} className="reuse-pill cand" title={`Candidate: ${c.clientName}`}>
                      + {c.clientName}
                    </span>
                  ))}
                  {b.deployed.length === 0 && b.candidates.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>not yet deployed</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Repos aren't a nav item any more — a build is the unit of work. But the
          commit log and AI work summary live on the repo, and 21 real repos are
          syncing, so the ones that roll up to nothing stay reachable here. */}
      <SHead
        title="Repos"
        right={
          repos ? (
            <span className="sample">
              {repos.length} tracked · {repos.length - unlinkedRepos.length} mapped to a build
            </span>
          ) : undefined
        }
      />
      {!repos ? (
        <EmptyState title="Repos can’t be read.">
          The database is unreachable, so the repo list is unknown rather than empty.
        </EmptyState>
      ) : unlinkedRepos.length === 0 ? (
        <div className="card pad">
          <div className="empty-inline">Every active repo is mapped to a build.</div>
        </div>
      ) : (
        <div className="card pad">
          <div className="eyebrow">Not mapped to a build</div>
          <p className="smol" style={{ marginBottom: 12 }}>
            Their commits are ingested and real, but they roll up to nothing. Open a build and link
            one to change that.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {unlinkedRepos.map((r) => (
              <Link key={r.id} href={`/repos/${r.id}`} className="linkcard" style={{ color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <b style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{r.name}</b>
                  <span className="stat" style={{ color: 'var(--ink-4)' }}>{ago(r.last_commit_at)}</span>
                </div>
                <div className="smol" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.last_commit_message ?? 'No commits ingested'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
