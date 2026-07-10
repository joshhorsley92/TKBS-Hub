// Person chip — Joe wears mint, Josh wears commit-blue, unknown wears edge.
const COLORS: Record<string, string> = {
  owner: 'bg-commit text-[#eef4ff]',
  engineer: 'bg-mint text-bg',
};

export function Avatar({
  name,
  role,
  size = 28,
}: {
  name: string;
  role?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-heading font-bold ${COLORS[role ?? ''] ?? 'bg-edge text-ink-2'}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
