'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { I } from './icons';

// Write confirmation.
//
// The reference fires a toast on every mutation (`flash()`), and the first build
// shipped none — so logging a decision, reassigning an owner or completing a
// task all succeeded in total silence. On a board whose whole job is to be
// trusted, a write you can't see is a write you don't believe happened.
//
// aria-live="polite" so screen readers announce it without stealing focus.

type Toast = { id: number; text: string };

const ToastCtx = createContext<(text: string) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

const DISMISS_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((text: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), text }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), DISMISS_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false">
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className="toast"
            // Stack, newest at the bottom, without a wrapper that would
            // intercept clicks on the board behind it.
            style={{ bottom: 28 + i * 52 }}
          >
            <I.spark width="14" height="14" aria-hidden />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
