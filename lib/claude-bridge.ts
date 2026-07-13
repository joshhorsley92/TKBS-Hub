import { spawn } from 'node:child_process';

// Headless Claude Code bridge — the Hub's command bar remote-controls the
// same Claude Code Joe uses in VS Code, on this machine, in this repo.
// Cost model: the child process env has ANTHROPIC_API_KEY / AUTH_TOKEN
// stripped, so the CLI authenticates with the logged-in Claude subscription
// (Max plan) — zero marginal cost, shared weekly limits. Never API-billed.

export type BridgeEvent =
  | { k: 'init'; sessionId: string }
  | { k: 't'; text: string }
  | { k: 'tool'; name: string; detail: string }
  | { k: 'done'; result: string; ms: number }
  | { k: 'error'; message: string };

export type BridgeMode = 'safe' | 'full';

// One command at a time — the console shows a busy state instead of queuing.
let running = false;
export function isRunning() {
  return running;
}

const SAFE_TOOLS =
  'Read Glob Grep Edit Write TodoWrite WebFetch WebSearch Bash(git status*) Bash(git log*) Bash(git diff*) Bash(npm run typecheck*)';

function summarizeToolInput(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const first =
    (i.file_path as string) ??
    (i.command as string) ??
    (i.pattern as string) ??
    (i.url as string) ??
    (i.query as string) ??
    (i.prompt as string) ??
    '';
  return String(first).slice(0, 120);
}

export function runClaude(opts: {
  prompt: string;
  mode: BridgeMode;
  sessionId?: string | null;
  signal: AbortSignal;
  onEvent: (e: BridgeEvent) => void;
  onClose: () => void;
}): { started: boolean } {
  if (running) return { started: false };
  running = true;

  const started = Date.now();
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  if (opts.mode === 'full') {
    args.push('--dangerously-skip-permissions');
  } else {
    args.push('--permission-mode', 'acceptEdits', '--allowedTools', SAFE_TOOLS);
  }
  if (opts.sessionId) args.push('--resume', opts.sessionId);

  // Strip API-billing credentials so the CLI uses the subscription login.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  // Windows npm shim is a .cmd — needs a shell. The prompt goes via stdin,
  // never through the shell command line (no quoting/injection surface).
  const child = spawn('claude', args, {
    cwd: process.cwd(),
    env,
    shell: true,
    windowsHide: true,
  });

  child.stdin.write(opts.prompt);
  child.stdin.end();

  let buffer = '';
  let doneSent = false;
  const send = (e: BridgeEvent) => {
    try {
      opts.onEvent(e);
    } catch {
      /* client gone */
    }
  };

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      if (msg.type === 'system' && msg.subtype === 'init') {
        send({ k: 'init', sessionId: String(msg.session_id ?? '') });
      } else if (msg.type === 'stream_event') {
        const ev = msg.event as { type?: string; delta?: { type?: string; text?: string } };
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          send({ k: 't', text: ev.delta.text });
        }
      } else if (msg.type === 'assistant') {
        const content = (msg.message as { content?: { type: string; name?: string; input?: unknown }[] })?.content ?? [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            send({ k: 'tool', name: block.name ?? 'tool', detail: summarizeToolInput(block.name ?? '', block.input) });
          }
        }
      } else if (msg.type === 'result') {
        doneSent = true;
        send({
          k: 'done',
          result: String(msg.result ?? (msg.subtype === 'success' ? '' : `ended: ${msg.subtype}`)),
          ms: Date.now() - started,
        });
      }
    }
  });

  let stderrTail = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
  });

  const cleanup = () => {
    running = false;
    opts.onClose();
  };

  child.on('close', (code) => {
    if (!doneSent) {
      send({
        k: 'error',
        message: code === 0 ? 'stream ended without result' : `claude exited ${code}: ${stderrTail.slice(-400)}`,
      });
    }
    cleanup();
  });
  child.on('error', (err) => {
    send({ k: 'error', message: err.message });
    cleanup();
  });

  opts.signal.addEventListener('abort', () => {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  });

  return { started: true };
}
