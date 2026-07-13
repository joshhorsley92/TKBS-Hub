'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { I } from './icons';
import { useWorkspace } from './WorkspaceProvider';

// The universal command bar (⌘K / Ctrl-K).
//
// Two things live here:
//   1. JUMP — pure client-side fuzzy nav over the real board index. No AI, no
//      latency, works offline. This is most of the day-to-day value.
//   2. ASK — streams from /api/claude, which drives the headless Claude Code
//      running on this machine (subscription-billed, no API key). It answers
//      from the repo and can edit it.
//
// The reference prototype also gave Claude in-browser tools that mutated the
// board (add_initiative, log_decision, …). Those need a server-side tool loop
// against the Anthropic API; ANTHROPIC_API_KEY isn't set, so they aren't wired.
// Board edits go through the real forms instead — see the "+" buttons on each
// page. Nothing here pretends to have done something it hasn't.

export type Destination = { label: string; href: string; hint: string };

type Entry =
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string }
  | { kind: 'tool'; text: string }
  | { kind: 'error'; text: string };

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

export function AskClaude() {
  const router = useRouter();
  const { destinations } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [modKey, setModKey] = useState('Ctrl K');

  useEffect(() => setModKey(IS_MAC ? '⌘K' : 'Ctrl K'), []);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [log, open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const push = useCallback((e: Entry) => {
    setLog((prev) => {
      // Coalesce streamed text chunks into one growing message.
      const last = prev[prev.length - 1];
      if (e.kind === 'ai' && last?.kind === 'ai') {
        return [...prev.slice(0, -1), { kind: 'ai', text: last.text + e.text }];
      }
      return [...prev, e];
    });
  }, []);

  const matches = q.trim()
    ? destinations.filter((d) => d.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5)
    : [];

  const jump = (d: Destination) => {
    router.push(d.href);
    setOpen(false);
    setQ('');
    setSel(-1);
  };

  async function send() {
    const text = q.trim();
    if (!text || busy) return;
    setQ('');
    setSel(-1);
    push({ kind: 'user', text });
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: text, mode: 'safe', sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        push({ kind: 'error', text: body.error ?? `HTTP ${res.status}` });
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
            else if (ev.k === 't') push({ kind: 'ai', text: ev.text });
            else if (ev.k === 'tool') push({ kind: 'tool', text: `⚙ ${ev.name} ${ev.detail ?? ''}`.trim() });
            else if (ev.k === 'done') router.refresh();
            else if (ev.k === 'error') push({ kind: 'error', text: ev.message });
          } catch {
            /* partial line — wait for the rest */
          }
        }
      }
    } catch (err) {
      const e = err as Error;
      push({ kind: 'error', text: e.name === 'AbortError' ? 'Stopped.' : e.message });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length) setSel((s) => Math.min(s + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, -1));
    } else if (e.key === 'Enter') {
      if (sel >= 0 && matches[sel]) jump(matches[sel]);
      else void send();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      <button className="claude-fab" onClick={() => setOpen((o) => !o)} title={`Ask Claude (${modKey})`}>
        <I.spark width="18" height="18" aria-hidden />
        <span>Ask Claude</span>
        <kbd>{modKey}</kbd>
      </button>

      {open && (
        <div className="claude-panel">
          <div className="cp-head">
            <I.spark width="15" height="15" aria-hidden />
            <b>Hub assistant</b>
            <span className="cp-badge">ask · jump</span>
            <button className="cp-x" aria-label="Close assistant" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="cp-log" ref={scroller}>
            {log.length === 0 && (
              <div className="cp-msg sys">
                Jump to any screen, or ask about the repo. Try “Astro Paws” to jump, or “what shipped
                this week?” to ask. Claude runs headless on this machine and reads the real
                repository — it answers from what’s actually there.
              </div>
            )}
            {log.map((m, i) =>
              m.kind === 'tool' ? (
                <div key={i} className="cp-tool">
                  {m.text}
                </div>
              ) : (
                <div key={i} className={`cp-msg ${m.kind === 'user' ? 'user' : m.kind === 'error' ? 'sys' : 'ai'}`}>
                  {m.kind === 'error' ? `⚠︎ ${m.text}` : m.text}
                </div>
              ),
            )}
            {busy && <div className="cp-msg ai busy">thinking…</div>}
          </div>

          {matches.length > 0 && (
            <div className="cp-nav">
              <div className="cp-nav-h">Jump to · ↑↓ then ⏎, or ⏎ to ask</div>
              {matches.map((d, i) => (
                <div
                  key={d.href}
                  className={`cp-nav-i${i === sel ? ' sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => jump(d)}
                >
                  <I.arrow width="13" height="13" />
                  <span>{d.label}</span>
                  <span className="h">{d.hint}</span>
                </div>
              ))}
            </div>
          )}

          <div className="cp-input">
            <input
              autoFocus
              placeholder="Ask, or jump to a client, build, initiative…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(-1);
              }}
              onKeyDown={onKey}
            />
            {busy ? (
              <button onClick={() => abortRef.current?.abort()} title="Stop" style={{ background: 'var(--danger)', color: '#fff' }}>
                ■
              </button>
            ) : (
              <button onClick={() => void send()} disabled={!q.trim()} title="Ask Claude">
                <I.arrow width="16" height="16" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
