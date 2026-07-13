import Link from 'next/link';
import type { Campaign, Lead } from '@/lib/board';
import { getPipeline } from '@/lib/board';
import { DASH, PLATFORM, STAGE_PROB, STAGES, ago, fitColor, money, num } from '@/lib/broadsheet';
import { Chip, EmptyState, SHead } from '@/components/broadsheet/primitives';
import {
  AddCampaignButton,
  AddLeadButton,
  ProposalButton,
  StageAdvance,
} from '@/components/broadsheet/pipeline/PipelineForms';

export const dynamic = 'force-dynamic';

// Pipeline — acquisition.
//
// On day one this entire screen is an empty state, and that is the correct
// rendering: `campaigns` and `leads` are empty tables, and neither Meta nor
// Google is connected, so there is no spend, no reach and no funnel to draw.
// Nothing here is seeded to make the page look busy.
//
// Two null rules run through everything below:
//   · a figure nobody recorded is `—`, never 0 — spend, reach, clicks, fit,
//     est. value are all nullable because a human may enter a lead knowing only
//     its name;
//   · a DERIVED figure whose inputs are unknown is `—` plus a line saying why.
//     We never divide by an assumed zero to manufacture a cost-per-lead.
// An unscored, unvalued lead is still a real lead: it sits in the funnel and
// contributes nothing to the weighted total.

type Tone = 'mint' | 'amber' | 'blue' | 'violet' | '';

const STAGE_TONE: Record<string, Tone> = {
  new: '',
  qualified: 'blue',
  proposal: 'violet',
  won: 'mint',
  lost: '',
};

/**
 * Sum of the values somebody has actually recorded. Returns null when none of
 * them is known — an empty set is "we don't know", not zero. When only some are
 * known the caller is expected to caveat the partial sum; see the `.smol` lines.
 */
function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/** Reach reads better compact, but an unknown impression count stays a dash. */
function reach(n: number | null): string {
  if (n === null) return DASH;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : num(n);
}

/**
 * The Fit-Score ring. `fit` is nullable on purpose — a hand-added lead nobody
 * has scored yet gets an empty grey ring and a dash, NOT a 0% ring, which would
 * read as "scored, and terrible".
 */
function FitRing({ fit }: { fit: number | null }) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const scored = fit !== null;

  return (
    <div
      className="fit"
      style={{ color: scored ? fitColor(fit) : 'var(--line)' }}
      title={scored ? `Fit score ${fit}/100` : 'Not scored yet'}
    >
      <svg viewBox="0 0 36 36" width="38" height="38">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="3.5" />
        {scored && (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fit / 100)}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      <span className="fit-n" style={scored ? undefined : { color: 'var(--ink-4)', fontWeight: 400 }}>
        {scored ? fit : DASH}
      </span>
    </div>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const platform = lead.campaignPlatform ? PLATFORM[lead.campaignPlatform] : undefined;
  const open = lead.stage !== 'won' && lead.stage !== 'lost';

  return (
    <div className="leadrow">
      <FitRing fit={lead.fit} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 15 }}>{lead.name}</span>
          <Chip tone={STAGE_TONE[lead.stage] ?? ''}>{lead.stage}</Chip>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
          {/* No campaign means nobody attributed one — the lead was entered by
              hand in the hub, which is a source, not an unknown. */}
          {lead.industry ?? DASH} · via {platform ? platform.label : 'hub'} · {ago(lead.createdAt)}
        </div>
      </div>

      <div style={{ textAlign: 'right', marginRight: 4, flexShrink: 0 }}>
        <div
          style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 14 }}
          className={lead.estValue === null ? 'unk' : undefined}
        >
          {money(lead.estValue)}
          {lead.estValue !== null && lead.recurring ? '/mo' : ''}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>est. value</div>
      </div>

      <StageAdvance leadId={lead.id} stage={lead.stage} />

      {open && <ProposalButton lead={lead} />}

      {lead.stage === 'won' &&
        (lead.clientId ? (
          <Link href={`/clients/${lead.clientId}`}>
            <Chip tone="mint" title="Converted — open the client record">
              <span className="pd" />
              in hub
            </Chip>
          </Link>
        ) : (
          // Won but unlinked: the conversion write didn't land. Say so rather
          // than link nowhere.
          <Chip tone="amber" title="Won, but no client record is linked to this lead">
            no client linked
          </Chip>
        ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const p = PLATFORM[campaign.platform];
  // Cost per lead is only real when we know the spend AND a lead is attributed
  // to this campaign. Otherwise it's a dash, not a $0.
  const cpl =
    campaign.spend !== null && campaign.leadCount > 0 ? campaign.spend / campaign.leadCount : null;

  return (
    <div className="card campcard">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span className="camp-glyph" style={{ background: p?.color ?? 'var(--ink-4)' }}>
            {p?.glyph ?? '?'}
          </span>
          <span style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 15 }}>{campaign.name}</span>
          <Chip tone={campaign.status === 'active' ? 'mint' : ''}>{campaign.status}</Chip>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 7 }}>
          {campaign.note ?? (
            <span className="unk">No note. Spend, reach and clicks are hand-entered until the platform is wired.</span>
          )}
        </p>
      </div>

      <div className="camp-stats">
        <div className="cs">
          <b className={campaign.impressions === null ? 'unk' : undefined}>{reach(campaign.impressions)}</b>
          <small>reach</small>
        </div>
        <div className="cs">
          <b className={campaign.clicks === null ? 'unk' : undefined}>{num(campaign.clicks)}</b>
          <small>clicks</small>
        </div>
        <div className="cs">
          {/* A lead count of 0 is a fact we know, not a missing value. */}
          <b>{campaign.leadCount}</b>
          <small>leads</small>
        </div>
        <div className={cpl === null ? 'cs' : 'cs hl'} title={cpl === null ? 'Needs both a recorded spend and at least one attributed lead' : undefined}>
          <b className={cpl === null ? 'unk' : undefined}>{money(cpl)}</b>
          <small>/ lead</small>
        </div>
      </div>
    </div>
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const [{ campaigns, leads }, { stage: rawStage }] = await Promise.all([getPipeline(), searchParams]);

  const stageKeys = STAGES.map(([key]) => key);
  // The funnel filter lives in the URL so this page stays a server component.
  const stage = rawStage && stageKeys.includes(rawStage) ? rawStage : 'all';

  /* ── the three tiles ───────────────────────────────────────────────────── */

  const adSpend = sumKnown(campaigns.map((c) => c.spend));
  const spendMissing = campaigns.filter((c) => c.spend === null).length;
  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  // Leads that an ad campaign actually bought. Hand-added leads cost nothing to
  // acquire, so folding them in would flatter the cost per lead.
  const attributed = campaigns.reduce((sum, c) => sum + c.leadCount, 0);
  const costPerLead = adSpend !== null && attributed > 0 ? adSpend / attributed : null;

  const live = leads.filter((l) => l.stage !== 'lost');
  const valued = live.filter((l) => l.estValue !== null);
  const weighted = valued.length
    ? valued.reduce((sum, l) => sum + l.estValue! * (STAGE_PROB[l.stage] ?? 0), 0)
    : null;
  const unvalued = live.length - valued.length;

  /* ── the funnel ────────────────────────────────────────────────────────── */

  const at = (key: string) => leads.filter((l) => l.stage === key);
  const maxCount = Math.max(1, ...stageKeys.map((k) => at(k).length));
  const lost = leads.filter((l) => l.stage === 'lost');
  const shown = stage === 'all' ? live : at(stage);
  const campaignOptions = campaigns.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Pipeline</h1>
          <p className="sub">
            Where the next client comes from. Meta and Google aren’t connected — every figure below is
            one a human entered, and anything nobody entered reads as “—”.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <AddCampaignButton />
          <AddLeadButton campaigns={campaignOptions} />
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 4 }}>
        <div className="card pad">
          {/* Deliberately NOT labelled "30d": `campaigns.spend` is a single
              running total, so there is no 30-day window to report. Calling a
              lifetime figure a 30-day one would be inventing the window. */}
          <div className="eyebrow">Ad spend · recorded</div>
          <div className={`bignum${adSpend === null ? ' unk' : ''}`}>{money(adSpend)}</div>
          <div className="smol">
            {campaigns.length === 0
              ? 'No campaigns yet. No ad platform is connected, so spend is hand-entered.'
              : adSpend === null
                ? `None of the ${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} has a spend recorded — unknown, not zero.`
                : `${activeCount} active · ${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}${
                    spendMissing ? ` · ${spendMissing} with no spend recorded` : ''
                  }`}
          </div>
        </div>

        <div className="card pad">
          <div className="eyebrow">Cost / lead</div>
          <div className={`bignum${costPerLead === null ? ' unk' : ''}`}>{money(costPerLead)}</div>
          <div className="smol">
            {adSpend === null
              ? 'Needs a recorded ad spend before it can be divided by anything.'
              : attributed === 0
                ? 'No lead is attributed to a campaign yet, so there is nothing to divide the spend by.'
                : `${attributed} lead${attributed === 1 ? '' : 's'} attributed to campaigns${
                    leads.length > attributed ? ` · ${leads.length - attributed} hand-added, excluded` : ''
                  }`}
          </div>
        </div>

        <div className="card pad">
          <div className="eyebrow">Weighted pipeline</div>
          <div className={`bignum${weighted === null ? ' unk' : ''}`}>{money(weighted)}</div>
          <div className="smol">
            {live.length === 0
              ? 'No open leads to weight.'
              : weighted === null
                ? `None of the ${live.length} open lead${live.length === 1 ? '' : 's'} carries an estimate.`
                : `Stage-probability weighted${
                    unvalued ? ` · ${unvalued} open lead${unvalued === 1 ? '' : 's'} with no estimate, counted as nothing` : ''
                  }`}
          </div>
        </div>
      </div>

      <SHead
        title="Deal funnel"
        right={leads.length > 0 ? <span className="sample">click a stage to filter</span> : undefined}
      />
      <div className="card pad">
        <div className="funnel">
          {STAGES.map(([key, label, prob]) => {
            const rows = at(key);
            // Sum only the estimates somebody actually made. Unvalued leads at a
            // stage still count toward `n` — they just add nothing to the value.
            const value = sumKnown(rows.map((l) => l.estValue));
            const on = stage === key;

            return (
              <Link
                key={key}
                href={on ? '/pipeline' : `/pipeline?stage=${key}`}
                scroll={false}
                className={`fn-stage${on ? ' on' : ''}`}
                style={{ color: 'var(--ink)' }}
              >
                <div
                  className="fn-bar"
                  style={{
                    height: `${28 + (rows.length / maxCount) * 88}px`,
                    background: key === 'won' ? 'var(--mint)' : 'var(--ink)',
                    opacity: key === 'won' ? 1 : 0.35 + 0.6 * prob,
                  }}
                >
                  <span className="fn-n">{rows.length}</span>
                </div>
                <div className="fn-lab">{label}</div>
                <div className="fn-val">{money(value)}</div>
              </Link>
            );
          })}
        </div>

        {lost.length > 0 && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--line-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span className="eyebrow">Lost / parked</span>
            {lost.map((l) => (
              <Chip key={l.id} title={l.note ?? 'No reason recorded.'}>
                {l.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <SHead title="Campaigns" />
      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns recorded." action={<AddCampaignButton />}>
          Meta Business Suite and Google Ads aren’t connected, so nothing syncs in on its own — spend,
          reach and clicks are hand-entered until they are. Add the campaign you’re running (or
          “Organic” for word-of-mouth) and the leads you attribute to it will start costing something
          you can measure.
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      <SHead
        title={
          <>
            Leads{' '}
            {stage !== 'all' && (
              <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 14 }}>· {stage}</span>
            )}
          </>
        }
        right={
          stage !== 'all' ? (
            <Link href="/pipeline" scroll={false} className="tog">
              Clear filter
            </Link>
          ) : undefined
        }
      />

      {leads.length === 0 ? (
        <EmptyState title="The funnel is empty." action={<AddLeadButton campaigns={campaignOptions} />}>
          Leads arrive two ways: from a campaign, or hand-added after a call. Each one carries a Fit
          Score (0–100) that says how well it matches the ICP — leave it blank if nobody has scored the
          lead yet and it stays honestly unscored rather than a zero. Winning a lead converts it into a
          real client record in the hub, so the roster and the funnel can’t drift apart.
        </EmptyState>
      ) : (
        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map((l) => (
            <LeadRow key={l.id} lead={l} />
          ))}
          {shown.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--ink-4)',
                padding: '24px 0',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
            >
              NO LEADS AT THIS STAGE
            </div>
          )}
        </div>
      )}
    </>
  );
}
