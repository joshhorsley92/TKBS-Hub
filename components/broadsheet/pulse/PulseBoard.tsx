'use client';

import type { ReactNode } from 'react';
import type { Attention as AttentionItem, Initiative, MoneyBoard, Signal, Task } from '@/lib/board';
import { greeting } from '@/lib/broadsheet';
import { ALL_PULSE, PULSE_LABEL, type PulseKey } from '@/lib/workspace';
import { I } from '../icons';
import { useWorkspace } from '../WorkspaceProvider';
import { useDnD } from '../CustomizeDrawer';
import { Digest } from './Digest';
import { LiveSignals } from './LiveSignals';
import { Attention } from './Attention';
import { LookAhead } from './LookAhead';
import { ActiveInitiatives, Projection, StatusStamp } from './Modules';

export type PulseData = {
  signals: Signal[];
  attention: AttentionItem[];
  initiatives: Initiative[];
  tasks: Task[];
  money: MoneyBoard;
  lastSync: string | null;
  syncFailed: boolean;
};

/** A module in edit mode: drag handle + hide, wrapping the live card. */
function ModuleCard({
  id,
  editing,
  h,
  onHide,
  children,
}: {
  id: PulseKey;
  editing: boolean;
  h: ReturnType<ReturnType<typeof useDnD<PulseKey>>['handlers']>;
  onHide: () => void;
  children: ReactNode;
}) {
  if (!editing) return <div className="pmod">{children}</div>;

  const { dragging, isOver, ...dnd } = h;
  return (
    <div className={`pmod edit${dragging ? ' drag' : ''}${isOver ? ' over' : ''}`} {...dnd}>
      <div className="mod-bar">
        <span className="grip">
          <I.grip width="18" height="18" />
        </span>
        <span className="mt">{PULSE_LABEL[id]}</span>
        <button
          className="hide"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
        >
          Hide
        </button>
      </div>
      {children}
    </div>
  );
}

export function PulseBoard({ data }: { data: PulseData }) {
  const { person, profile, editing, patch } = useWorkspace();

  const order = profile.pulse;
  const hidden = ALL_PULSE.filter((id) => !order.includes(id));
  // Compact density → the digest becomes a two-line highlights brief.
  const brief = profile.theme.density === 'compact';

  const { handlers } = useDnD<PulseKey>(order, (next) => patch((p) => ({ ...p, pulse: next })));
  const hide = (id: PulseKey) => patch((p) => ({ ...p, pulse: p.pulse.filter((x) => x !== id) }));
  const add = (id: PulseKey) => patch((p) => ({ ...p, pulse: [...p.pulse, id] }));

  const render = (id: PulseKey): ReactNode => {
    switch (id) {
      case 'digest':
        return <Digest brief={brief} />;
      case 'signals':
        return <LiveSignals initial={data.signals} />;
      case 'attention':
        return <Attention items={data.attention} />;
      case 'initiatives':
        return <ActiveInitiatives initiatives={data.initiatives} />;
      case 'calendar':
        return <LookAhead tasks={data.tasks} />;
      case 'projection':
        return <Projection board={data.money} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="topline">
        <div>
          <h1 className="h1">
            {greeting()}, {person.first}.
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
          <StatusStamp lastSync={data.lastSync} failed={data.syncFailed} />
        </div>
      </div>

      {editing && (
        <p className="dw-note" style={{ margin: '0 0 18px', fontSize: 12.5 }}>
          Drag cards to reorder · <b>Hide</b>{' '}from the corner · open the panel to add cards,
          switch theme, pages &amp; landing.
        </p>
      )}

      <div className="pmods">
        {order.map((id) => (
          <ModuleCard key={id} id={id} editing={editing} h={handlers(id)} onHide={() => hide(id)}>
            {render(id)}
          </ModuleCard>
        ))}
      </div>

      {editing && (
        <div className="modtray" style={{ marginTop: 22 }}>
          <div className="th">Hidden cards {hidden.length ? '· tap to add back' : ''}</div>
          {hidden.length ? (
            <div className="row">
              {hidden.map((id) => (
                <button key={id} className="modchip" onClick={() => add(id)}>
                  <span className="pl">+</span>
                  {PULSE_LABEL[id]}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">All cards are on your Pulse.</div>
          )}
        </div>
      )}
    </>
  );
}
