import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getBuilds, getClient, getPeople } from '@/lib/board';
import { safeQuery } from '@/lib/data';
import {
  BUILD_KIND_COLOR,
  DASH,
  LIFE_TYPE_COLOR,
  SRC_COLOR,
  SRC_LABEL,
  dueText,
  fmt,
  fmtY,
  money,
  num,
} from '@/lib/broadsheet';
import { Avatar, EmptyState, LifeLine, SHead } from '@/components/broadsheet/primitives';
import {
  ClientNoteForm,
  FbMapping,
  StageHealthControls,
  type FbClientOption,
} from '@/components/broadsheet/clients/ClientForms';

export const dynamic = 'force-dynamic';

// One client, whole.
//
// The record is thin on purpose: there is no channels table, no docs table and
// no "next action" column. Rather than invent any of them, this page shows the
// three things that are real — the life-line, the full history behind it, and
// the builds/contacts on file — and says out loud what the missing sections are
// waiting on.

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await getClient(id);
  if (!client) notFound();

  const [people, builds, upcoming, fbClients] = await Promise.all([
    getPeople(),
    getBuilds(),
    // There is no `next_action` on a client. The honest stand-in is the soonest
    // open dated work item pointed at them — a real row someone queued, not a
    // suggestion this page made up. Overdue counts: a late task IS the next move.
    safeQuery<{ id: string; title: string; due_on: string | null; profile_id: string }[]>((s) =>
      s
        .from('work_items')
        .select('id, title, due_on, profile_id')
        .eq('client_id', client.id)
        .in('status', ['now', 'next'])
        .not('due_on', 'is', null)
        .order('due_on')
        .limit(1),
    ),
    safeQuery<{ fb_id: number; organization: string | null; email: string | null }[]>((s) =>
      s.from('fb_clients').select('fb_id, organization, email').order('organization'),
    ),
  ]);

  const peopleById = people?.byId ?? {};

  const nextAction =
    (upcoming ?? []).find((r): r is typeof r & { due_on: string } => Boolean(r.due_on)) ?? null;

  // Builds that are actually deployed here — a candidate is a maybe, and a maybe
  // is not a record.
  const serving = builds.filter((b) => b.deployed.some((d) => d.clientId === client.id));

  const fbOptions: FbClientOption[] = (fbClients ?? []).map((f) => ({
    fb_id: f.fb_id,
    label: f.organization || f.email || `#${f.fb_id}`,
  }));

  // buildLifeLine returns oldest-first; the river reads newest-first.
  // `line` is the readable arc (work clustered by month); `history` is every
  // event uncollapsed. The river wants the latter — newest first.
  const history = [...client.history].reverse();
  const contactLines = [client.contactName, client.contactEmail, client.contactPhone].filter(Boolean);

  return (
    <>
      <Link href="/clients" className="backlink">
        ← All clients
      </Link>

      <div className="topline">
        <div>
          <div className="kicker">
            {client.stage} · since {client.since ? fmtY(client.since) : DASH}
          </div>
          <h1 className="h1">{client.name}</h1>
          <p className="sub">{client.notes ?? 'No context written on this client yet.'}</p>
        </div>
        <div className="stamp">
          {/* Engagement is words, not money — "Launch → Boost", not a number. */}
          <div>Engagement · {client.engagement ?? DASH}</div>
          <div
            style={{ marginTop: 6, color: nextAction ? 'var(--mint-ink)' : undefined }}
            title={nextAction ? undefined : 'No dated work item is queued against this client.'}
          >
            Next touch · {nextAction ? fmt(nextAction.due_on) : DASH}
          </div>
        </div>
      </div>

      {nextAction && (
        <div className="nextaction">
          <div>
            <div className="eyebrow">Next action</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--disp)', fontSize: 15, marginTop: 4 }}>
              {nextAction.title}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Avatar person={peopleById[nextAction.profile_id]} />
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 5 }}>
              {dueText(nextAction.due_on)}
            </div>
          </div>
        </div>
      )}

      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="life" style={{ padding: '8px 4px 14px' }}>
          <LifeLine events={client.line} peopleById={peopleById} />
        </div>
      </div>

      <SHead title="Channels" />
      <EmptyState title="No channel numbers to show.">
        Reach, spend and engagement per channel land here once Meta Business Suite and the social
        integrations are connected. Until then this client has no channel figures — not zeroes, and
        nothing worth estimating.
      </EmptyState>

      <div className="grid2" style={{ marginTop: 26, alignItems: 'start' }}>
        <div>
          <SHead title="Full history" style={{ margin: '0 0 12px' }} />
          <div className="card pad">
            {history.length === 0 ? (
              <div className="empty-inline">Nothing recorded against this client yet.</div>
            ) : (
              <div className="river">
                {history.map((e, i) => (
                  <div key={`${e.d}-${i}`} className="ev">
                    <span
                      className="node2"
                      style={{ background: LIFE_TYPE_COLOR[e.type] ?? 'var(--ink-4)' }}
                    />
                    <span className="t">{fmtY(e.d)}</span>
                    <div className="body">
                      <b>{e.t}</b>
                      <div className="meta">
                        <span className="chip" style={{ color: SRC_COLOR[e.src] }}>
                          {SRC_LABEL[e.src]}
                        </span>
                        {e.by && <Avatar person={peopleById[e.by]} />}
                        {e.amt != null && <span className="chip mint">{money(e.amt)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SHead title="Record" style={{ margin: '0 0 12px' }} />
          <div className="card pad">
            <div className="eyebrow">Stage &amp; health</div>
            <StageHealthControls id={client.id} stage={client.stage} health={client.health} />

            <hr className="rule" style={{ margin: '18px 0 0' }} />

            <div className="eyebrow" style={{ marginTop: 16 }}>
              Builds serving this client
            </div>
            {serving.length > 0 ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {serving.map((b) => (
                  <Link
                    key={b.id}
                    href={`/builds/${b.id}`}
                    className="linkcard"
                    style={{ color: 'var(--ink)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="bd-dot"
                        style={{ background: BUILD_KIND_COLOR[b.kind] ?? 'var(--ink-4)' }}
                      />
                      <b style={{ fontFamily: 'var(--disp)', fontSize: 13.5 }}>{b.name}</b>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                      {/* eng_hours is hand-entered; nobody has logged it for most builds. */}
                      {b.engHours == null ? 'Hours not recorded' : `${num(b.engHours)}h invested`} ·
                      reused by {b.deployed.length} client{b.deployed.length === 1 ? '' : 's'}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-inline">
                No build is recorded as deployed here. Deployments are set on the build, not here.
              </div>
            )}

            <hr className="rule" style={{ margin: '18px 0 0' }} />

            <div className="eyebrow" style={{ marginTop: 16 }}>
              Contact
            </div>
            {contactLines.length > 0 || client.website ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {client.contactName && (
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{client.contactName}</div>
                )}
                {client.contactEmail && (
                  <a href={`mailto:${client.contactEmail}`} style={{ fontSize: 11.5 }}>
                    {client.contactEmail}
                  </a>
                )}
                {client.contactPhone && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{client.contactPhone}</div>
                )}
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11.5 }}
                  >
                    {client.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            ) : (
              <div className="empty-inline">
                No contact on file — name, email, phone and website are all unset.
              </div>
            )}

            <hr className="rule" style={{ margin: '18px 0 0' }} />

            <div className="eyebrow" style={{ marginTop: 16 }}>
              Log a note
            </div>
            {/* Append-only: each note becomes a client_events row, so it shows up on
                the life-line above and in Full history. With FreshBooks and the
                calendar still dark, this and repo commits are the only things that
                move this client's record at all. */}
            <ClientNoteForm id={client.id} />

            <hr className="rule" style={{ margin: '18px 0 0' }} />

            <div className="eyebrow" style={{ marginTop: 16 }}>
              FreshBooks
            </div>
            {fbOptions.length > 0 ? (
              <FbMapping clientId={client.id} current={client.fbClientId} options={fbOptions} />
            ) : (
              <div className="empty-inline">
                Nothing to map to yet — the FreshBooks client list appears after the first sync, and
                mapping is what makes revenue and cost attribute to this client.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
