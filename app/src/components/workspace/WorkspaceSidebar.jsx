/**
 * WorkspaceSidebar — right-hand sidebar for ProjectWorkspace.
 * All state/handlers come from ProjectWorkspace via props; no local state is added here.
 */
export default function WorkspaceSidebar({
  progress,
  teamMembers,
  items,
  setSelectedItem,
  total,
  doneCount,
  inProgress,
  onTimelog,
  projectId,
}) {
  return (
    <div>
      {/* Sprint Health */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 22, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 7 }}>Sprint Health</div>
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 52, lineHeight: 1,
          color: progress >= 70 ? 'var(--jade)' : progress >= 40 ? 'var(--warn)' : 'var(--danger)',
          letterSpacing: '-0.03em'
        }}>{progress}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>
          {progress >= 70 ? 'God fremdrift' : progress >= 40 ? 'Måske lidt langsomme' : 'Bagud — kræver fokus'}
        </div>
      </div>

      {/* Team widget */}
      {teamMembers.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>Team</div>
          {teamMembers.map(member => {
            const memberItems = items.filter(i => i.assigned_to === member.id);
            const activeItem = memberItems.find(i => { const s = i.item_status || i.status; return s === 'in_progress' || s === 'active'; });
            const overloaded = memberItems.filter(i => { const s = i.item_status || i.status; return s !== 'done' && s !== 'completed'; }).length > 5;
            return (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: overloaded ? 'rgba(232,84,84,0.12)' : 'rgba(0,200,150,0.1)',
                  border: `1px solid ${overloaded ? 'var(--danger)' : 'var(--border2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: overloaded ? 'var(--danger)' : 'var(--text2)',
                  position: 'relative',
                }}>
                  {(member.display_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: overloaded ? 'var(--danger)' : 'var(--jade)', border: '1px solid var(--bg)' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{member.display_name}</div>
                  <div style={{ fontSize: 10, color: overloaded ? 'var(--danger)' : 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {overloaded ? '⚠ Overloaded' : activeItem ? activeItem.title.slice(0, 28) + (activeItem.title.length > 28 ? '…' : '') : 'Ingen aktiv opgave'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Quests */}
      {(() => {
        const sidequests = items.filter(i => i.priority === 'high' && (i.item_status === 'in_progress' || i.item_status === 'backlog')).slice(0, 3);
        if (!sidequests.length) return null;
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 12 }}>⚔</span>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--epic)' }}>Side Quests</span>
            </div>
            {sidequests.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                style={{
                  background: 'var(--epic-dim)', border: '1px solid var(--epic-border)',
                  borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--epic)', letterSpacing: '0.06em' }}>⚔ Epic · Side Quest</span>
                  <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>+{Math.max(30, Math.round((item.estimated_hours || 8) * 4))} XP</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{item.item_code} · {item.item_status === 'in_progress' ? 'In Progress' : 'Backlog'}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Active Challenges */}
      <div style={{ background: 'var(--epic-dim)', border: '1px solid var(--epic-border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--epic)', marginBottom: 10 }}>⚔ Active Challenges</div>
        {/* Zero blocker challenge — auto-tracked */}
        {(() => {
          const blocked = items.filter(i => i.item_status === 'blocked').length;
          const pct = blocked === 0 ? 100 : Math.max(0, 100 - blocked * 20);
          return (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>Zero blocker sprint</div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', background: 'var(--epic)', borderRadius: 2, width: `${pct}%`, transition: 'width 0.8s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                {blocked === 0 ? 'Ingen blokkere · +80 XP ved sprint-close' : `${blocked} blokker${blocked > 1 ? 'e' : ''} · løs dem for at beholde XP`}
              </div>
            </div>
          );
        })()}
        {/* Velocity challenge */}
        {(() => {
          const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          return (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>Sprint velocity: {doneCount}/{total} done</div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', background: pct >= 80 ? 'var(--jade)' : 'var(--epic)', borderRadius: 2, width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{pct >= 80 ? '🏆 On track for full completion!' : `Mål: 80% · ${pct}% nu`}</div>
            </div>
          );
        })()}
      </div>

      {/* Stats */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 14 }}>Overview</div>
        <StatRow label="Total items" value={total} />
        <StatRow label="In progress" value={inProgress.length} color="var(--jade)" />
        <StatRow label="Completed" value={doneCount} />
        <StatRow label="Est. timer" value={items.reduce((s, i) => s + (i.estimated_hours || 0), 0).toFixed(0)} />
        <StatRow label="FAK timer" value={items.reduce((s, i) => s + (i.hours_fak || 0), 0).toFixed(1)} />
      </div>

      {/* Timelog link */}
      {onTimelog && (
        <button
          onClick={() => onTimelog(projectId)}
          style={{
            width: '100%', padding: '11px', borderRadius: 'var(--radius)',
            background: 'var(--jade)', color: '#0c0c0f',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ⏱ Open Timelog →
        </button>
      )}
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
