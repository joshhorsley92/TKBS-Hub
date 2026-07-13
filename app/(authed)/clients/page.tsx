import Link from 'next/link';

import { getClients, getMoney, getPeople } from '@/lib/board';
import { Chip, EmptyState, LifeLine, MoneyTrio } from '@/components/broadsheet/primitives';
import { AddClientButton } from '@/components/broadsheet/clients/ClientForms';

export const dynamic = 'force-dynamic';

// The roster.
//
// One card per client, each one carrying its whole relationship as a life-line.
// Everything on the card is read from the record: the stage and health a human
// set, the contact and industry they typed, the commits in that client's repos,
// and the money — which is currently unknown for everyone, because FreshBooks
// isn't connected. An unknown reads as an em dash, never as zero.

type Tone = 'mint' | 'amber' | 'blue' | 'violet' | '';

const STAGE_TONE: Record<string, Tone> = {
  active: 'mint',
  proposal: 'violet',
  discovery: 'blue',
  paused: 'amber',
};

// Reading order is by commitment, not alphabet: the people paying us now sit
// above the people who might. getClients() already sorts by name, so within a
// stage the order stays alphabetical.
const STAGE_RANK = ['active', 'proposal', 'discovery', 'prospect', 'paused', 'past'];
const rankOf = (stage: string) => {
  const i = STAGE_RANK.indexOf(stage);
  return i === -1 ? STAGE_RANK.length : i;
};

export default async function ClientsPage() {
  const [clients, people, money] = await Promise.all([getClients(), getPeople(), getMoney()]);

  // The layout blocks rendering when profiles are missing, so this is only a
  // type guard — an unresolvable actor id simply shows no avatar.
  const peopleById = people?.byId ?? {};
  const roster = [...clients].sort((a, b) => rankOf(a.stage) - rankOf(b.stage));

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">Clients</h1>
        </div>
        <AddClientButton />
      </div>

      {roster.length === 0 ? (
        <EmptyState title="No clients on the board." action={<AddClientButton />}>
          Add the first one and its life-line starts the same day. From then on the card fills itself
          in from what actually happens — notes logged here, commits in the repos linked to them, and
          invoices once FreshBooks is connected.
        </EmptyState>
      ) : (
        <div style={{ marginTop: 14 }}>
          {roster.map((c) => {
            // Both are optional columns. Saying which are missing beats printing
            // a row of dashes, and beats guessing either one.
            const wo = [c.contactName, c.industry].filter(Boolean).join(' · ');

            return (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="card clientcard"
                style={{ display: 'block', color: 'var(--ink)' }}
              >
                <div className="life">
                  <div className="life-top">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="nm">{c.name}</span>
                        {c.health && (
                          <Chip tone={c.health === 'green' ? 'mint' : 'amber'}>
                            <span className="pd" />
                            {c.health}
                          </Chip>
                        )}
                        <Chip tone={STAGE_TONE[c.stage] ?? ''}>{c.stage}</Chip>
                      </div>
                      <div className="wo">{wo || 'No contact or industry recorded'}</div>
                    </div>
                    <MoneyTrio
                      revenue={c.money.revenueActual}
                      cost={c.money.costActual}
                      potential={c.money.potentialMonthly}
                      freshbooksConnected={money.freshbooksConnected}
                    />
                  </div>
                  <LifeLine events={c.line} peopleById={peopleById} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
