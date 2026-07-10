import Link from 'next/link';
import { Panel, EmptyState } from '@/components/console/Panel';
import { NewClientForm } from '@/components/clients/ClientControls';
import { safeQuery, isDbConfigured } from '@/lib/data';
import { age } from '@/lib/format';

type ClientRow = {
  id: string;
  name: string;
  stage: string;
  health: string | null;
  industry: string | null;
  website: string | null;
  updated_at: string;
};

const STAGE_ORDER = ['active', 'proposal', 'discovery', 'prospect', 'paused', 'past'];
const STAGE_COLOR: Record<string, string> = {
  prospect: 'text-ink-4',
  discovery: 'text-commit-2',
  proposal: 'text-commit-2',
  active: 'text-actual',
  paused: 'text-warn',
  past: 'text-ink-5',
};

export default async function ClientsPage() {
  const clients = await safeQuery<ClientRow[]>((s) =>
    s.from('clients').select('id, name, stage, health, industry, website, updated_at'),
  );

  const sorted = (clients ?? []).sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Clients</h1>
          <p className="font-mono text-[11px] text-ink-4">
            {clients ? `${clients.length} total · ${clients.filter((c) => c.stage === 'active').length} active` : 'status board'}
          </p>
        </div>
        <NewClientForm />
      </div>

      <Panel label="Client status board">
        {!clients || clients.length === 0 ? (
          <EmptyState>{isDbConfigured() ? 'NO CLIENTS YET' : 'DB NOT CONNECTED'}</EmptyState>
        ) : (
          <table className="console-table font-mono">
            <thead>
              <tr>
                <th>Client</th><th>Stage</th><th>Health</th><th>Industry</th><th>Touched</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="text-ink transition hover:text-mint">
                      {c.name}
                    </Link>
                  </td>
                  <td className={STAGE_COLOR[c.stage] ?? ''}>{c.stage.toUpperCase()}</td>
                  <td>
                    {c.health ? (
                      <span className={c.health === 'green' ? 'text-actual' : c.health === 'yellow' ? 'text-warn' : 'text-danger'}>
                        ● {c.health}
                      </span>
                    ) : (
                      <span className="text-ink-5">not set</span>
                    )}
                  </td>
                  <td className="max-w-[280px] truncate text-ink-4" title={c.industry ?? undefined}>
                    {c.industry ?? '—'}
                  </td>
                  <td className="text-ink-4">{age(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
