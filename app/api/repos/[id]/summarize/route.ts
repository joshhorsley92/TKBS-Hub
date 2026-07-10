import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { summarizeRepo } from '@/lib/summarize';

export const maxDuration = 60;

// POST /api/repos/[id]/summarize — generate the AI "current work" summary
// from ingested commit history. On-demand only (deliberate token spend).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  try {
    const { summary } = await summarizeRepo(id);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
