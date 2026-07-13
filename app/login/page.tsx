'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { BRAND_MARK } from '@/components/broadsheet/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div className="brand" style={{ justifyContent: 'center', padding: '0 0 26px' }}>
          {BRAND_MARK}
          <div className="wm" style={{ fontSize: 20 }}>
            TKBS<span>.</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card pad" style={{ padding: '24px 26px' }}>
          <label className="fl" htmlFor="email" style={{ marginTop: 0 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="inp full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="fl" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="inp full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 10 }}>{error}</p>
          )}

          <button type="submit" className="btn mint" disabled={busy} style={{ width: '100%', marginTop: 18 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: 'var(--ink-4)', textAlign: 'center', marginTop: 14 }}>
          Internal hub · Joe &amp; Josh only
        </p>
      </div>
    </main>
  );
}
