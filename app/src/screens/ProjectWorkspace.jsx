import { useEffect, useState } from 'react';
import { getProject, getProjectSprints, getSprintItems, updateItemStatus } from '../lib/api';
import { useGameFeature } from '../shared/useGameFeature';

export default function ProjectWorkspace({ projectId, onBack, onTimelog }) {
  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const showXpBadges = useGameFeature('xpBadges');
  const showRarityStrips = useGameFeature('rarityStrips');

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    const [proj, sprintList] = await Promise.all([
      getProject(projectId),
      getProjectSprints(projectId)
    ]);
    setProject(proj);
    setSprints(sprintList);

    // Første aktive sprint
    const active = sprintList.find(s => s.status === 'active') || sprintList[0];
    if (active) {
      setActiveSprint(active);
      const sprintItems = await getSprintItems(active.id);
      setItems(sprintItems);
    }
    setLoading(false);
  }

  async function handleSprintChange(sprint) {
    setActiveSprint(sprint);
    const sprintItems = await getSprintItems(sprint.id);
    setItems(sprintItems);
  }

  // Gruppér items
  const backlog = items.filter(i => i.status === 'todo');
  const inProgress = items.filter(i => i.status === 'in_progress' || i.status === 'review');
  const done = items.filter(i => i.status === 'completed');

  // Burndown simuleret
  const total = items.length;
  const doneCount = done.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Rarity baseret på estimated_hours
  function getRarity(item) {
    const h = item.estimated_hours || 0;
    if (h >= 50) return 'epic';
    if (h >= 20) return 'rare';
    if (h >= 8) return 'uncommon';
    return 'common';
  }

  function rarityColor(r) {
    const colors = { common: 'var(--common)', uncommon: 'var(--uncommon)', rare: 'var(--rare)', epic: 'var(--epic)' };
    return colors[r] || 'var(--common)';
  }

  function xpForItem(item) {
    const h = item.estimated_hours || 0;
    return Math.max(10, Math.round(h * 3));
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Loading...</div>;
  }

  if (!project) {
    return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Project not found.</div>;
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius)', transition: 'color 0.15s' }}
          >
            ← Portfolio
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: '-0.02em' }}>
            {project.name}
          </div>
          {activeSprint && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', background: 'var(--jade-dim)',
              border: '1px solid rgba(0,200,150,0.22)',
              borderRadius: 16, fontSize: 11, color: 'var(--jade)', fontWeight: 500
            }}>
              {activeSprint.name}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {total} items · {doneCount} done · {progress}% complete
        </div>
      </div>

      {/* Sprint selector hvis mere end 1 */}
      {sprints.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {sprints.map(s => (
            <button
              key={s.id}
              onClick={() => handleSprintChange(s)}
              style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500,
                border: '1px solid',
                background: activeSprint?.id === s.id ? 'var(--jade-dim)' : 'none',
                borderColor: activeSprint?.id === s.id ? 'rgba(0,200,150,0.3)' : 'var(--border2)',
                color: activeSprint?.id === s.id ? 'var(--jade)' : 'var(--text2)',
                cursor: 'pointer'
              }}
            >
              {s.sprint_code || s.name}
            </button>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 22 }}>
        <div>
          {/* Rarity legend */}
          {showRarityStrips && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              <span style={{ color: 'var(--common)' }}>◈ Common</span>
              <span style={{ color: 'var(--uncommon)' }}>◈ Uncommon</span>
              <span style={{ color: 'var(--rare)' }}>◈ Rare</span>
              <span style={{ color: 'var(--epic)' }}>◈ Epic</span>
            </div>
          )}

          {/* Kanban columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <KanbanColumn
              title="Backlog"
              count={backlog.length}
              items={backlog}
              showXp={showXpBadges}
              showRarity={showRarityStrips}
              getRarity={getRarity}
              rarityColor={rarityColor}
              xpForItem={xpForItem}
              onStatusChange={async (itemId, newStatus) => {
                await updateItemStatus(itemId, newStatus);
                setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
              }}
              nextStatus="in_progress"
              nextLabel="Start →"
            />
            <KanbanColumn
              title="In Progress"
              titleColor="var(--jade)"
              count={inProgress.length}
              items={inProgress}
              showXp={showXpBadges}
              showRarity={showRarityStrips}
              getRarity={getRarity}
              rarityColor={rarityColor}
              xpForItem={xpForItem}
              onStatusChange={async (itemId, newStatus) => {
                await updateItemStatus(itemId, newStatus);
                setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
              }}
              nextStatus="completed"
              nextLabel="Done ✓"
            />
            <KanbanColumn
              title="Done"
              count={done.length}
              items={done}
              showXp={false}
              showRarity={showRarityStrips}
              getRarity={getRarity}
              rarityColor={rarityColor}
              xpForItem={xpForItem}
              dimmed={true}
            />
          </div>

          {/* Burndown */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 12 }}>
              Progress
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', background: 'var(--jade)', borderRadius: 3, width: `${progress}%`, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
              <span>{doneCount} done</span>
              <span>{total - doneCount} remaining</span>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          {/* Sprint health */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 22, marginBottom: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 7 }}>Sprint Health</div>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 52, lineHeight: 1,
              color: progress >= 70 ? 'var(--jade)' : progress >= 40 ? 'var(--warn)' : 'var(--danger)',
              letterSpacing: '-0.03em'
            }}>
              {progress}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>% complete</div>
          </div>

          {/* Stats */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 14 }}>Overview</div>
            <StatRow label="Total items" value={total} />
            <StatRow label="In progress" value={inProgress.length} color="var(--jade)" />
            <StatRow label="Completed" value={doneCount} />
            <StatRow label="Est. hours" value={items.reduce((s, i) => s + (i.estimated_hours || 0), 0).toFixed(0)} />
            <StatRow label="FAK hours" value={items.reduce((s, i) => s + (i.hours_fak || 0), 0).toFixed(1)} />
          </div>

          {/* Timelog link */}
          {onTimelog && (
            <button
              onClick={() => onTimelog(projectId)}
              style={{
                width: '100%', padding: '11px', borderRadius: 'var(--radius)',
                background: 'var(--jade)', color: '#0c0c0f',
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
            >
              ⏱ Open Timelog →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, titleColor, count, items, showXp, showRarity, getRarity, rarityColor, xpForItem, dimmed, onStatusChange, nextStatus, nextLabel }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: titleColor || 'var(--text3)' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--border)', padding: '2px 6px', borderRadius: 8 }}>{count}</span>
      </div>
      {items.map(item => {
        const rarity = getRarity(item);
        const color = rarityColor(rarity);
        const xp = xpForItem(item);
        return (
          <div
            key={item.id}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderLeft: showRarity ? `3px solid ${color}` : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '13px 13px 13px 16px',
              marginBottom: 7,
              opacity: dimmed ? 0.55 : 1,
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: onStatusChange ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              {showRarity && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color }}>{rarity}</span>
              )}
              {showXp && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid rgba(200,168,75,0.18)', padding: '2px 6px', borderRadius: 8 }}>
                  +{xp} XP
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 8, lineHeight: 1.4 }}>
              {item.item_code && <span style={{ color: 'var(--text3)', marginRight: 6 }}>{item.item_code}</span>}
              {item.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {item.estimated_hours ? `${item.estimated_hours}h est.` : '—'}
              </span>
              {onStatusChange && nextStatus && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, nextStatus); }}
                  style={{
                    fontSize: 10, padding: '2px 8px',
                    background: 'var(--jade-dim)', border: '1px solid rgba(0,200,150,0.25)',
                    borderRadius: 6, color: 'var(--jade)', cursor: 'pointer'
                  }}
                >
                  {nextLabel}
                </button>
              )}
              {dimmed && (
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>✓ {item.hours_fak ? `${item.hours_fak}h` : ''}</span>
              )}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div style={{ border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', padding: 14, textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
          Empty
        </div>
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
