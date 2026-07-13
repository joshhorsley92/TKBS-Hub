// Inline stroke icons, 24×24 viewBox — ported from the design handoff so the
// sidebar and controls match the reference exactly.

type P = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const I = {
  pulse: (p: P) => (
    <svg {...base} {...p}>
      <path d="M3 12h4l2 7 4-16 2 9h6" />
    </svg>
  ),
  init: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  ),
  clients: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M21 19a5.2 5.2 0 0 0-3.5-4.9" />
    </svg>
  ),
  builds: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  money: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
    </svg>
  ),
  time: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  plug: (p: P) => (
    <svg {...base} {...p}>
      <path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6" />
    </svg>
  ),
  spark: (p: P) => (
    <svg {...base} strokeWidth={1.8} {...p}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    </svg>
  ),
  arrow: (p: P) => (
    <svg {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  funnel: (p: P) => (
    <svg {...base} {...p}>
      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
    </svg>
  ),
  sliders: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  ),
  grip: (p: P) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  ),
  eye: (p: P) => (
    <svg {...base} {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeoff: (p: P) => (
    <svg {...base} {...p}>
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.2 4M6.3 6.3A15 15 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9M3 3l18 18M10 10a3 3 0 0 0 4 4" />
    </svg>
  ),
  clock: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 2h6M12 5V2" />
    </svg>
  ),
  repo: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </svg>
  ),
} satisfies Record<string, (p: P) => React.ReactElement>;

export const BRAND_MARK = (
  <svg className="mark" viewBox="0 0 34 26" aria-hidden="true">
    <circle cx="12" cy="13" r="9" fill="none" stroke="var(--mint)" strokeWidth="3.2" />
    <rect x="21" y="11" width="11" height="4" rx="1" fill="var(--mint)" />
  </svg>
);
