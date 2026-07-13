'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, RotateCcw, Square, X } from 'lucide-react';

// The always-visible Claude command line — remote control for the headless
// Claude Code running on this machine (subscription-billed, never API).
// SAFE mode: edits + read tools + git status/log/diff. FULL mode: everything
// (--dangerously-skip-permissions) — the same trust as a VS Code session.

type Entry =
  | { kind: 'cmd'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'text'; text: string }
  | { kind: 'done'; ms: number }
  | { kind: 'error'; text: string };

export function ClaudeBar() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'safe' | 'full'>('safe');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((e: Entry) => {
    setEntries((prev) => {
      // Merge consecutive text chunks into one streaming block
      if (e.kind === 'text' && prev.length && prev[prev.length - 1].kind === 'text') {
        const last = prev[prev.length - 1] as { kind: 'text'; text: string };
        return [...prev.slice(0, -1), { kind: 'text', text: last.text + e.text }];
      }
      return [...prev, e];
    });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setPrompt('');
    setBusy(true);
    setOpen(true);
    push({ kind: 'cmd', text: p });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, mode, sessionId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        push({ kind: 'error', text: body.error ?? `HTTP ${res.status}` });
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.k === 'init') setSessionId(ev.sessionId || null);
            else if (ev.k === 't') push({ kind: 'text', text: ev.text });
            else if (ev.k === 'tool') push({ kind: 'tool', name: ev.name, detail: ev.detail });
            else if (ev.k === 'done') {
              push({ kind: 'done', ms: ev.ms });
              router.refresh(); // data may have changed — refresh the page behind the bar
            } else if (ev.k === 'error') push({ kind: 'error', text: ev.message });
          } catch {
            /* partial line */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        push({ kind: 'error', text: (err as Error).message });
      } else {
        push({ kind: 'error', text: 'stopped' });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newSession() {
    setSessionId(null);
    setEntries([]);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-panel/95 backdrop-blur">
      {open && (
        <div className="border-b border-edge-2">
          <div className="flex items-center justify-between px-4 pt-2">
            <span className="p-label">Claude — this machine, this repo, subscription-billed</span>
            <span className="flex items-center gap-3">
              {sessionId && (
                <button onClick={newSession} title="start a fresh session" className="flex cursor-pointer items-center gap-1 font-mono text-[10px] text-ink-4 transition hover:text-ink-2">
                  <RotateCcw size={10} /> NEW SESSION
                </button>
              )}
              <button onClick={() => setOpen(false)} title="collapse" className="cursor-pointer text-ink-4 transition hover:text-ink-2">
                <X size={13} />
              </button>
            </span>
          </div>
          <div ref={scrollRef} className="max-h-[38vh] overflow-y-auto px-4 py-2 font-mono text-[11.5px]">
            {entries.map((en, i) => {
              if (en.kind === 'cmd') {
                return (
                  <div key={i} className="mt-2 flex gap-2 text-mint first:mt-0">
                    <span>▸</span>
                    <span className="text-ink">{en.text}</span>
                  </div>
                );
              }
              if (en.kind === 'tool') {
                return (
                  <div key={i} className="pl-4 text-[10.5px] text-ink-5">
                    ⚙ {en.name} <span className="text-ink-5/70">{en.detail}</span>
                  </div>
                );
              }
              if (en.kind === 'text') {
                return (
                  <div key={i} className="whitespace-pre-wrap pl-4 leading-relaxed text-ink-2">
                    {en.text}
                  </div>
                );
              }
              if (en.kind === 'done') {
                return (
                  <div key={i} className="pl-4 text-[10px] text-ink-5">
                    ● done in {(en.ms / 1000).toFixed(1)}s
                  </div>
                );
              }
              return (
                <div key={i} className="pl-4 text-danger">
                  {en.text}
                </div>
              );
            })}
            {busy && <div className="pl-4 text-[10.5px] text-warn">⋯ working</div>}
          </div>
        </div>
      )}

      <form onSubmit={run} className="flex items-center gap-2.5 px-4 py-2">
        <ChevronRight size={14} className={busy ? 'animate-pulse text-warn' : 'text-mint'} />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => entries.length > 0 && setOpen(true)}
          placeholder={busy ? 'claude is working — wait or stop' : 'tell claude… (status report, change a client, edit this site)'}
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-5"
        />
        {busy ? (
          <button type="button" onClick={stop} title="stop" className="flex cursor-pointer items-center gap-1 rounded-console border border-edge px-2 py-0.5 font-mono text-[10px] tracking-wider text-danger transition hover:border-danger">
            <Square size={9} /> STOP
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode(mode === 'safe' ? 'full' : 'safe')}
            title={mode === 'safe' ? 'SAFE: edits + read tools + git status. Click for FULL (all permissions).' : 'FULL: no permission checks — same trust as your VS Code session. Click for SAFE.'}
            className={`cursor-pointer rounded-console border px-2 py-0.5 font-mono text-[10px] tracking-wider transition ${
              mode === 'safe' ? 'border-edge text-ink-4 hover:text-ink-2' : 'border-warn/50 text-warn'
            }`}
          >
            {mode === 'safe' ? 'SAFE' : '⚠ FULL'}
          </button>
        )}
        {sessionId && <span title="following up in the same session" className="font-mono text-[9px] text-ink-5">◆ session</span>}
      </form>
    </div>
  );
}
