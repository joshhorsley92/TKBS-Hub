import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isRunning, runClaude, type BridgeMode } from '@/lib/claude-bridge';

export const maxDuration = 600;

// POST /api/claude — run a headless Claude Code command in this repo and
// stream NDJSON events back. One command at a time (409 when busy).
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const prompt = (body?.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  const mode: BridgeMode = body?.mode === 'full' ? 'full' : 'safe';
  const sessionId: string | null = body?.sessionId || null;

  if (isRunning()) {
    return NextResponse.json({ error: 'a command is already running — wait for it to finish' }, { status: 409 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const { started } = runClaude({
        prompt,
        mode,
        sessionId,
        signal: request.signal,
        onEvent: (e) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
          } catch {
            /* stream closed */
          }
        },
        onClose: () => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      });
      if (!started) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ k: 'error', message: 'busy' }) + '\n'),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
