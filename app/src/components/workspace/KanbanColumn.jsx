import EstimationPanel from './EstimationPanel';
import ExplosionPredictor from './ExplosionPredictor';

export default function KanbanColumn({
  colId, title, titleColor, count, items,
  showXp, showRarity, getRarity, rarityColor, xpForItem,
  dimmed, teamMembers,
  draggingId, dragOverCol,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onStatusChange, onAssigneeChange, onDueDateChange,
  nextStatus, nextLabel, onCardClick,
  selectedIds, onToggleSelect,
  organizationId,
}) {
  const isOver = dragOverCol === colId;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: isOver ? '2px solid var(--jade)' : '2px solid transparent',
        background: isOver ? 'var(--jade-dim)' : 'transparent',
        borderRadius: 'var(--radius-lg)',
        padding: 8,
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: 120,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: titleColor || 'var(--text3)' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--border)', padding: '2px 6px', borderRadius: 8 }}>{count}</span>
      </div>

      {items.map(item => {
        const rarity = getRarity(item);
        const color = rarityColor(rarity);
        const xp = xpForItem(item);
        const isDragging = draggingId === item.id;

        return (
          <div
            key={item.id}
            draggable={!dimmed}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              onDragStart(item.id);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick && onCardClick(item)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderLeft: showRarity ? `3px solid ${color}` : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '13px 13px 13px 16px',
              marginBottom: 7,
              opacity: isDragging ? 0.5 : (dimmed ? 0.55 : 1),
              transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
              cursor: dimmed ? 'default' : 'grab',
              transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
            }}
          >
            {/* Rarity + XP + Checkbox row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onToggleSelect && !dimmed && (
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(item.id) || false}
                    onChange={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--jade)' }}
                  />
                )}
                {showRarity && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color }}>{rarity}</span>
                )}
              </div>
              {showXp && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid rgba(200,168,75,0.18)', padding: '2px 6px', borderRadius: 8 }}>
                  +{xp} XP
                </span>
              )}
            </div>

            {/* Title */}
            <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>
              {item.is_unplanned && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', marginRight: 5,
                  background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.3)',
                  borderRadius: 6, color: 'var(--gold)', fontWeight: 700,
                }}>⚡ Unplanned</span>
              )}
              {item.item_code && <span style={{ color: 'var(--text3)', marginRight: 6 }}>{item.item_code}</span>}
              {item.title}
            </div>
            {/* Explosion Predictor badge */}
            {organizationId && !dimmed && (
              <div style={{ marginBottom: 6 }}>
                <ExplosionPredictor
                  itemTitle={item.title}
                  estimatedHours={item.estimated_hours}
                  organizationId={organizationId}
                />
              </div>
            )}

            {/* Meta row: assignee + due date — kun tekst, ingen inputs */}
            <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              {item.assigned_to && (
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                  👤 {teamMembers.find(m => m.id === item.assigned_to)?.display_name || 'Assigned'}
                </span>
              )}
              {item.due_date && !dimmed && (
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                  📅 {new Date(item.due_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>

            {/* Bottom row: hours + action/status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.estimated_hours ? `${item.estimated_hours}h` : '—'}
                {item.actual_hours != null && item.estimated_hours && (
                  <span style={{
                    fontSize: 10, marginLeft: 2,
                    color: item.actual_hours > item.estimated_hours * 1.3 ? 'var(--danger)' : item.actual_hours > item.estimated_hours ? 'var(--warn)' : 'var(--jade)',
                    fontWeight: 600,
                  }}>
                    → {item.actual_hours}h
                  </span>
                )}
              </span>
              {!dimmed && onStatusChange && nextStatus && (
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
                <span style={{ fontSize: 11, color: 'var(--jade)' }}>✓ {item.hours_fak ? `${item.hours_fak}h logget` : 'done'}</span>
              )}
            </div>

            {/* Estimation panel */}
            {!dimmed && (
              <div onClick={e => e.stopPropagation()}>
                <EstimationPanel item={item} />
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', padding: 14, textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
          {isOver ? 'Drop here' : 'Empty'}
        </div>
      )}
    </div>
  );
}
