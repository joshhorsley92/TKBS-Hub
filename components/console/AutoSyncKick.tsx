'use client';

import { useEffect, useRef } from 'react';

// Mounted on the cockpit: fires the staleness check once per page load,
// non-blocking. If a sync gets kicked, the next navigation shows fresh data.
export function AutoSyncKick() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch('/api/sync/kick', { method: 'POST' }).catch(() => {});
  }, []);

  return null;
}
