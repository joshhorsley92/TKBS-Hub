'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The daily digest.
//
// Written by /api/pulse/digest, which is only allowed to state what the
// database actually contains (see lib/pulse-digest.ts). When no AI key is
// configured it returns a plain factual brief instead of prose — so this card
// always says something true, and shows a badge when it's the unembellished
// version. The typing animation is cosmetic; the words underneath are not.
export function Digest({ brief }: { brief: boolean }) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState('');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);

  const typeOut = useCallback((s: string) => {
    if (typer.current) clearInterval(typer.current);
    let i = 0;
    setShown('');
    typer.current = setInterval(() => {
      i += 2;
      setShown(s.slice(0, i));
      if (i >= s.length && typer.current) {
        clearInterval(typer.current);
        typer.current = null;
      }
    }, 16);
  }, []);

  const gen = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/pulse/digest${brief ? '?brief=1' : ''}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setText(body.text);
      setAi(Boolean(body.ai));
      typeOut(body.text);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [brief, typeOut]);

  // Regenerate on mount AND whenever the brief/full form changes — switching to
  // Josh flips density to compact, which is a request for the 2-line highlights
  // version, not the same paragraph. Guarding on the last-rendered form (rather
  // than a fire-once ref) gets that without double-fetching under StrictMode.
  const lastForm = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastForm.current === brief) return;
    lastForm.current = brief;
    void gen();
  }, [brief, gen]);

  useEffect(
    () => () => {
      if (typer.current) clearInterval(typer.current);
    },
    [],
  );

  return (
    <div className="card pad digest-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
        <span className="chip mint">
          <span className="pd" />
          {brief ? 'Daily digest · highlights' : 'Daily digest'}
        </span>
        {!ai && !busy && text && (
          <span className="chip" title="ANTHROPIC_API_KEY isn't set, so this is the raw factual brief rather than written prose. It's still only what the data says.">
            facts only
          </span>
        )}
        <button className="tog" style={{ marginLeft: 'auto' }} onClick={() => !busy && void gen()}>
          {busy ? 'Writing…' : 'Regenerate'}
        </button>
      </div>

      {err ? (
        <div className="digest" style={{ color: 'var(--danger)' }}>
          Couldn’t write the digest: {err}
        </div>
      ) : (
        <div className={`digest${busy ? ' typing' : ''}`}>{shown || (busy ? '' : '…')}</div>
      )}
    </div>
  );
}
