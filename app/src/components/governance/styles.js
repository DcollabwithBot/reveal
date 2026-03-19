export const governanceStyles = {
  govGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '8px', marginBottom: '12px' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px', marginBottom: '12px' },
  widget: { background: '#131629', border: '1px solid #374151', padding: '10px' },
  widgetTitle: { fontSize: '7px', color: '#9ca3af', marginBottom: '6px' },
  widgetValue: { fontSize: '16px', color: '#a78bfa', marginBottom: '4px' },
  widgetHint: { fontSize: '6px', color: '#6b7280' },
  sectionBox: { background: '#101425', border: '1px solid #374151', padding: '10px', minHeight: '170px' },
  sectionTitle: { fontSize: '8px', color: '#d1d5db', marginBottom: '10px' },
  queueItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #2e364a', background: '#0f1220', padding: '8px', marginBottom: '6px' },
  queueItemApproved: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #2f5040', background: '#0f1a15', padding: '8px', marginBottom: '6px' },
  queueMeta: { display: 'flex', flexDirection: 'column', gap: '4px' },
  queueTarget: { fontSize: '7px', color: '#e5e7eb' },
  queueState: { fontSize: '6px', color: '#9ca3af' },
  queueActions: { display: 'flex', gap: '6px' },
  actionBtn: { border: '1px solid #374151', padding: '5px 8px', fontFamily: "'Press Start 2P', monospace", fontSize: '7px', cursor: 'pointer' },
  approveBtn: { background: '#065f46', color: '#ecfeff' },
  rejectBtn: { background: '#7f1d1d', color: '#fef2f2' },
  applyBtn: { background: '#1d4ed8', color: '#eff6ff' },
  conflictRow: { border: '1px solid #2d1d4d', background: '#120f1f', padding: '8px', marginBottom: '6px' },
  conflictMain: { display: 'flex', flexDirection: 'column', gap: '4px' },
  conflictTarget: { fontSize: '7px', color: '#e9d5ff' },
  conflictReason: { fontSize: '6px', color: '#d1d5db' },
  conflictMeta: { fontSize: '6px', color: '#8b5cf6', marginTop: '4px' },
  suggestionRow: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' },
  suggestionBadge: { fontSize: '6px', color: '#ddd6fe', border: '1px solid #6d28d9', padding: '3px 5px', background: '#22103a' },
  projectRow: { display: 'flex', justifyContent: 'space-between', gap: '8px', border: '1px solid #27324a', background: '#0f1220', padding: '8px', marginBottom: '6px' },
  projectName: { fontSize: '7px', color: '#e5e7eb', marginBottom: '4px' },
  projectMeta: { fontSize: '6px', color: '#9ca3af' },
  projectStats: { fontSize: '6px', color: '#a78bfa', whiteSpace: 'nowrap' },
  activityRow: { borderBottom: '1px solid #253046', padding: '6px 0' },
  activityTitle: { fontSize: '7px', color: '#e5e7eb', marginBottom: '4px' },
  activityMeta: { fontSize: '6px', color: '#9ca3af' },
  muted: { fontSize: '7px', color: '#6b7280' },
  error: { fontSize: '7px', color: '#fda4af', marginBottom: '8px' }
};

export function formatShortDate(value) {
  if (!value) return 'ukendt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ukendt';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
