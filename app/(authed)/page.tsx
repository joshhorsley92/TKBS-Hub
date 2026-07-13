import { safeQuery } from '@/lib/data';
import {
  deriveAttention,
  getClients,
  getInitiatives,
  getMoney,
  getPeople,
  getSignals,
  getTasks,
} from '@/lib/board';
import { AutoSyncKick } from '@/components/broadsheet/AutoSyncKick';
import { PulseBoard, type PulseData } from '@/components/broadsheet/pulse/PulseBoard';

export const dynamic = 'force-dynamic';

// Pulse — the landing surface.
//
// Everything here is read from the live database. Each module renders its own
// honest empty state when there's nothing to show; none of them invent a row to
// look busy.
export default async function PulsePage() {
  const [people, signals, initiatives, clients, tasks, money, runs, repoSync] = await Promise.all([
    getPeople(),
    getSignals(8),
    getInitiatives(),
    getClients(),
    getTasks(),
    getMoney(),
    safeQuery<{ status: string }[]>((s) =>
      s
        .from('ingest_runs')
        .select('status')
        .eq('job', 'github_poll')
        .order('created_at', { ascending: false })
        .limit(1),
    ),
    safeQuery<{ last_synced_at: string | null }[]>((s) =>
      s
        .from('repos')
        .select('last_synced_at')
        .not('last_synced_at', 'is', null)
        .order('last_synced_at', { ascending: false })
        .limit(1),
    ),
  ]);

  const data: PulseData = {
    signals,
    attention: people ? deriveAttention(initiatives, clients, people) : [],
    initiatives,
    tasks,
    money,
    lastSync: repoSync?.[0]?.last_synced_at ?? null,
    syncFailed: runs?.[0]?.status === 'failed',
  };

  return (
    <>
      <AutoSyncKick />
      <PulseBoard data={data} />
    </>
  );
}
