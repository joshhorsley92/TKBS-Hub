'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Maximize2, Minimize2, RotateCcw, Square, X } from 'lucide-react';

// The always-visible Claude command line — remote control for the headless
// Claude Code running on this machine (subscription-billed, never API).
// Output is a 5-line ticker that auto-follows the action; expand for the
// full transcript. SAFE mode: edits + read tools + git status/log/diff.
// FULL mode: everything (--dangerously-skip-permissions).

type Entry =
  | { kind: 'cmd'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'text'; text: string }
  | { kind: 'done'; ms: number }
  | { kind: 'error'; text: string };

// 5 lines × ~18px line-height
const COMPACT_H = 92;

export function ClaudeBar() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'safe' | 'full'>('safe');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true); // auto-follow unless the user scrolls up

  const stickToBottom = useCallback(() => {
    if (!pinnedRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(stickToBottom, [entries, expanded, stickToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  const push = useCallback((e: Entry) => {
    setEntries((prev) => {
      // Merge consecutive text chunks into one streaming block
      if (e.kind === 'text' && prev.length && prev[prev.length - 1].kind === 'text') {
        const last = prev[prev.length - 1] as { kind: 'text'; text: string };
        return [...prev.slice(0, -1), { kind: 'text', text: last.text + e.text }];
      }
      return [...prev, e];
    });
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setPrompt('');
    setBusy(true);
    setOpen(true);
    pinnedRef.current = true;
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
      push({
        kind: 'error',
        text: (err as Error).name === 'AbortError' ? 'stopped' : (err as Error).message,
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // Compact view shows the tail; expanded shows everything.
  const visible = expanded ? entries : entries.slice(-40);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-panel/95 backdrop-blur">
      {open && entries.length > 0 && (
        <div className="border-b border-edge-2">
          <div className="flex items-center justify-between px-4 pt-1.5 pb-0.5">
            <span className="p-label truncate">
              Claude — this machine, this repo{busy ? ' · working…' : ''}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {sessionId && !busy && (
                <button
                  onClick={() => {
                    setSessionId(null);
                    setEntries([]);
                  }}
                  title="start a fresh session"
                  className="flex cursor-pointer items-center gap-1 font-mono text-[9.5px] text-ink-4 transition hover:text-ink-2"
                >
                  <RotateCcw size={10} /> NEW
                </button>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'collapse to 5 lines' : 'expand transcript'}
                className="cursor-pointer text-ink-4 transition hover:text-mint"
              >
                {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                title="hide output"
                className="cursor-pointer text-ink-4 transition hover:text-ink-2"
              >
                <X size={13} />
              </button>
            </span>
          </div>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="overflow-y-auto px-4 pb-1.5 font-mono text-[11px] leading-[18px]"
            style={{ height: expanded ? '46vh' : COMPACT_H }}
          >
            {visible.map((en, i) => {
              if (en.kind === 'cmd') {
                return (
                  <div key={i} className="flex gap-1.5 text-mint">
                    <span className="shrink-0">▸</span>
                    <span className={`text-ink ${expanded ? '' : 'truncate'}`}>{en.text}</span>
                  </div>
                );
              }
              if (en.kind === 'tool') {
                return (
                  <div key={i} className="flex gap-1.5 truncate pl-3 text-[10.5px] text-ink-5">
                    <span className="shrink-0 text-ink-4">⚙</span>
                    <span className="shrink-0">{en.name}</span>
                    <span className="truncate opacity-70">{en.detail}</span>
                  </div>
                );
              }
              if (en.kind === 'text') {
                return (
                  <div
                    key={i}
                    className={`pl-3 text-ink-2 ${expanded ? 'whitespace-pre-wrap' : 'truncate'}`}
                    title={expanded ? undefined : en.text}
                  >
                    {expanded ? en.text : en.text.replace(/\s+/g, ' ').trim()}
                  </div>
                );
              }
              if (en.kind === 'done') {
                return (
                  <div key={i} className="pl-3 text-[10px] text-actual">
                    ● done in {(en.ms / 1000).toFixed(1)}s
                    {!expanded && ' — expand ⤢ to read the full answer'}
                  </div>
                );
              }
              return (
                <div key={i} className={`pl-3 text-danger ${expanded ? '' : 'truncate'}`}>
                  {en.text}
                </div>
              );
            })}
            {busy && <div className="pl-3 text-[10.5px] text-warn">⋯</div>}
          </div>
        </div>
      )}

      <form onSubmit={run} className="flex items-center gap-2.5 px-4 py-1.5">
        <ChevronRight size={14} className={busy ? 'animate-pulse text-warn' : 'text-mint'} />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => entries.length > 0 && setOpen(true)}
          placeholder={busy ? 'claude is working — wait or stop' : 'tell claude… (status report, change a client, edit this site)'}
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-5"
        />
        {!open && entries.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer font-mono text-[9.5px] tracking-wider text-ink-5 transition hover:text-ink-2"
          >
            SHOW OUTPUT
          </button>
        )}
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            title="stop"
            className="flex cursor-pointer items-center gap-1 rounded-console border border-edge px-2 py-0.5 font-mono text-[10px] tracking-wider text-danger transition hover:border-danger"
          >
            <Square size={9} /> STOP
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode(mode === 'safe' ? 'full' : 'safe')}
            title={
              mode === 'safe'
                ? 'SAFE: edits + read tools + git status. Click for FULL (all permissions).'
                : 'FULL: no permission checks — same trust as your VS Code session. Click for SAFE.'
            }
            className={`cursor-pointer rounded-console border px-2 py-0.5 font-mono text-[10px] tracking-wider transition ${
              mode === 'safe' ? 'border-edge text-ink-4 hover:text-ink-2' : 'border-warn/50 text-warn'
            }`}
          >
            {mode === 'safe' ? 'SAFE' : '⚠ FULL'}
          </button>
        )}
        {sessionId && (
          <span title="following up in the same session" className="shrink-0 font-mono text-[9px] text-ink-5">
            ◆
          </span>
        )}
      </form>
    </div>
  );
}
