'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Attention as Item } from '@/lib/board';
import { PERSON_TONE, SRC_LABEL } from '@/lib/broadsheet';
import { Avatar } from '../primitives';
import { useWorkspace } from '../WorkspaceProvider';
import { useToast } from '../Toast';

// "Needs deciding".
//
// DERIVED, never stored. An item is here because something is actually true: an
// initiative is blocked, or a client's health was set to yellow/red. There is no
// attention table to stuff — you clear this list by fixing the thing, not by
// dismissing the card.
//
// The owner chip is clickable on initiative-backed items: it reassigns the
// initiative's owner for real. On client-health items the owner is derived from
// the source lane and isn't a stored field, so the chip explains rather than
// pretending to be editable.
export function Attention({ items }: { items: Item[] }) {
  const router = useRouter();
  const { me, people, peopleById, profile, roster } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  // Focus filter: 'me' shows only this person's; 'all' surfaces theirs first.
  const mine = items.filter((a) => a.ownerKey === me);
  const theirs = items.filter((a) => a.ownerKey !== me);
  const list = profile.ownerFilter === 'me' ? mine : [...mine, ...theirs];

  async function reassign(item: Item, e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.initiativeId || busy) return;

    // Three seats now, so this cycles rather than toggles.
    const i = roster.findIndex((p) => p.key === item.ownerKey);
    const next = roster[(i + 1) % roster.length];
    if (!next) return;
    const nextKey = next.key;
    setBusy(item.id);
    try {
      const res = await fetch(`/api/initiatives/${item.initiativeId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner_id: next.id }),
      });
      if (res.ok) {
        toast(`Reassigned to ${next.first}`);
        router.refresh();
      } else {
        toast('Couldn’t reassign — the change wasn’t saved');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="shead">
        <h3>Needs deciding</h3>
        {profile.ownerFilter === 'me' && theirs.length > 0 && (
          <span className="sample">{theirs.length} more on the others’ plates</span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="es-t">Nothing is waiting on a decision.</div>
          <div className="es-s">
            This list fills itself: an initiative gets blocked, or a client’s health turns yellow or
            red. It’s empty because neither has happened — not because nothing has been entered.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((a) => {
            const owner = people[a.ownerKey];
            if (!owner) return null;
            const canReassign = Boolean(a.initiativeId);
            return (
              // A card, not a link: it contains a button, and nesting an
              // interactive element inside an <a> is invalid. So it gets the
              // link semantics by hand — reachable by Tab, activated by
              // Enter/Space, announced as a link.
              <div
                key={a.id}
                className={`att ${a.sev}`}
                role="link"
                tabIndex={0}
                onClick={() => router.push(a.href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(a.href);
                  }
                }}
              >
                <span className="tick" aria-hidden />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>{a.title}</h4>
                  <p>{a.sub}</p>
                </div>
                <button
                  className={`ownerchip chip ${PERSON_TONE[a.ownerKey]}`}
                  disabled={!canReassign || busy === a.id}
                  aria-label={
                    canReassign
                      ? `Owned by ${owner.first}. Click to reassign to the next person.`
                      : `Owned by ${owner.first}, derived from source ${SRC_LABEL[a.src]}`
                  }
                  title={
                    canReassign
                      ? `Owned by ${owner.first} — click to cycle the owner`
                      : `Owner derived from source · ${SRC_LABEL[a.src]} → ${owner.first}`
                  }
                  style={!canReassign ? { cursor: 'default' } : undefined}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => void reassign(a, e)}
                >
                  <Avatar person={peopleById[owner.id]} /> {owner.first}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
