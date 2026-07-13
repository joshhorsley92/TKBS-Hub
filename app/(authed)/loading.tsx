// Shown while a page waits on the database.
//
// Every view is `force-dynamic`, so navigation blocks on Supabase for a few
// hundred milliseconds. Without this the console just froze on the old page and
// then snapped to the new one. The skeleton mirrors the real layout — a topline
// and a stack of cards — so nothing jumps when the content lands.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="topline">
        <div className="skel skel-h1" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel skel-card" style={{ opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    </div>
  );
}
