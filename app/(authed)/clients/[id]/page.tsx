import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Panel, EmptyState } from '@/components/console/Panel';
import { NoteForm, StageHealthControls } from '@/components/clients/ClientControls';
import { FbMappingSelect, type FbClientOption } from '@/components/clients/FbMappingSelect';
import { safeQuery } from '@/lib/data';
import { age, logStamp } from '@/lib/format';

type ClientEvent = {
  id: number;
  kind: string;
  body: string;
  created_at: string;
  profiles: { name: string } | null;
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await safeQuery<{
    id: string;
    name: string;
    stage: string;
    health: string | null;
    industry: string | null;
    website: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    updated_at: string;
    fb_client_id: number | null;
  }>((s) =>
    s
      .from('clients')
      .select('id, name, stage, health, industry, website, contact_name, contact_email, contact_phone, notes, updated_at, fb_client_id')
      .eq('id', id)
      .single(),
  );
  if (!client) notFound();

  const [events, repos, fbClients] = await Promise.all([
    safeQuery<ClientEvent[]>((s) =>
      s
        .from('client_events')
        .select('id, kind, body, created_at, profiles:actor_id (name)')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<ClientEvent[]>(),
    ),
    safeQuery<{ id: string; name: string; last_commit_at: string | null }[]>((s) =>
      s.from('repos').select('id, name, last_commit_at').eq('client_id', id),
    ),
    safeQuery<{ fb_id: number; organization: string | null; email: string | null }[]>((s) =>
      s.from('fb_clients').select('fb_id, organization, email').order('organization'),
    ),
  ]);

  const fbOptions: FbClientOption[] = (fbClients ?? []).map((f) => ({
    fb_id: f.fb_id,
    label: f.organization || f.email || `#${f.fb_id}`,
  }));

  return (
    <div>
      <Link href="/clients" className="mb-3 flex w-fit items-center gap-1.5 font-mono text-[11px] text-ink-4 transition hover:text-ink-2">
        <ArrowLeft size={12} /> CLIENT BOARD
      </Link>

      <div className="mb-3">
        <h1 className="text-lg font-bold">{client.name}</h1>
        <p className="font-mono text-[11px] text-ink-4">
          {client.industry ?? 'industry not set'}
          {client.website ? (
            <>
              {' · '}
              <a href={client.website} target="_blank" rel="noreferrer" className="transition hover:text-mint">
                {client.website.replace(/^https?:\/\//, '')}
              </a>
            </>
          ) : null}
          {' · touched '}{age(client.updated_at)} ago
        </p>
        {(client.contact_name || client.contact_email || client.contact_phone) && (
          <p className="mt-0.5 font-mono text-[11px] text-ink-4">
            {[client.contact_name, client.contact_email, client.contact_phone].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <Panel className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <StageHealthControls id={client.id} stage={client.stage} health={client.health} />
          {fbOptions.length > 0 ? (
            <FbMappingSelect clientId={client.id} current={client.fb_client_id} options={fbOptions} />
          ) : (
            <span className="font-mono text-[10px] text-ink-5">FreshBooks mapping appears after first FB sync</span>
          )}
        </div>
      </Panel>

      {client.notes && (
        <Panel label="Context" className="mb-3">
          <p className="max-w-[90ch] whitespace-pre-wrap text-[12.5px] text-ink-3">{client.notes}</p>
        </Panel>
      )}

      {repos && repos.length > 0 && (
        <Panel label="Linked repos" className="mb-3">
          <div className="flex flex-wrap gap-3 font-mono text-[11.5px]">
            {repos.map((r) => (
              <Link key={r.id} href={`/repos/${r.id}`} className="text-ink-2 transition hover:text-mint">
                {r.name} <span className="text-ink-5">({age(r.last_commit_at)})</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <Panel label="History">
        <div className="mb-2">
          <NoteForm id={client.id} />
        </div>
        {!events || events.length === 0 ? (
          <EmptyState>NO HISTORY YET</EmptyState>
        ) : (
          <div className="font-mono">
            {events.map((e) => (
              <div key={e.id} className="flex items-baseline gap-2.5 border-b border-edge-2 py-[5.5px] text-[11.5px] last:border-b-0">
                <span className="w-[42px] shrink-0 text-ink-5">{logStamp(e.created_at)}</span>
                <span className={`w-[52px] shrink-0 text-[9.5px] font-bold tracking-wider ${
                  e.kind === 'stage_change' ? 'text-commit-2' : e.kind === 'health_change' ? 'text-warn' : 'text-pot'
                }`}>
                  {e.kind === 'stage_change' ? 'STAGE' : e.kind === 'health_change' ? 'HEALTH' : 'NOTE'}
                </span>
                <span className="min-w-0 flex-1 text-ink-2">{e.body}</span>
                <span className={`shrink-0 text-[10px] ${e.profiles?.name?.startsWith('Josh') ? 'text-commit-2' : e.profiles ? 'text-mint' : 'text-ink-5'}`}>
                  {(e.profiles?.name ?? '').split(' ')[0].toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
