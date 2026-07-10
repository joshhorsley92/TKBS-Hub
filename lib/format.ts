// Small formatting helpers used across the console.

// Relative age like the repo board's AGE column: 18m, 5h, 3d, 6w, 4mo
export function age(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return 'now';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 9) return `${w}w`;
  const mo = Math.floor(d / 30.44);
  return `${mo}mo`;
}

// A repo older than this is flagged "stale" (amber) on the boards.
export function isStale(date: string | Date | null | undefined, days = 21): boolean {
  if (!date) return false;
  return Date.now() - new Date(date).getTime() > days * 86_400_000;
}

export function shortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// HH:MM for the event log's timestamp gutter (today) or -Nd for older
export function logStamp(date: string | Date): string {
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) {
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  return `-${days}d`;
}

export function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
