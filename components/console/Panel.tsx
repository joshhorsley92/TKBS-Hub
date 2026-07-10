import type { ReactNode } from 'react';

// The console panel — bordered, near-black, square-ish corners.
export function Panel({
  label,
  action,
  children,
  className = '',
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-console border border-edge bg-panel p-[13px_15px_11px] ${className}`}>
      {(label || action) && (
        <div className="mb-1 flex items-center justify-between">
          {label && <span className="p-label">{label}</span>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Honest empty/not-connected state — never renders a fabricated zero.
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="py-6 text-center font-mono text-[11px] tracking-wide text-ink-5">
      {children}
    </div>
  );
}
