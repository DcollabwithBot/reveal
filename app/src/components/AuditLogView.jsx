import { useState, useEffect, useCallback } from 'react';
import { getAuditLog } from '../lib/api';

const ACTION_ICONS = {
  'session.started':    { icon: '▶️', color: 'var(--jade)' },
  'session.completed':  { icon: '✅', color: 'var(--jade)' },
  'session.joined':     { icon: '👤', color: 'var(--text2)' },
  'vote.cast':          { icon: '🗳️', color: '#5fcde4' },
  'vote.revealed':      { icon: '🎴', color: '#feae34' },
  'approval.requested': { icon: '⏳', color: 'var(--gold)' },
  'approval.approved':  { icon: '✅', color: 'var(--jade)' },
  'approval.rejected':  { icon: '❌', color: 'var(--danger)' },
  'field.updated':      { icon: '✏️', color: 'var(--text2)' },
  'mission.completed':  { icon: '🏆', color: 'var(--gold)' },
  'visibility.changed': { icon: '🔒', color: 'var(--text2)' },
  'item.created':       { icon: '➕', color: 'var(--text2)' },
  'sprint.closed':      { icon: '🏁', color: '#feae34' },
  'default':            { icon: '📋', color: 'var(--text3)' },
};

function actionMeta(eventType) {
  return ACTION_ICONS[eventType] || ACTION_ICONS.default;
}

function formatTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' });
}

function exportCSV(logs) {
  const headers = ['Tid', 'Handling', 'Aktør', 'Entitet', 'Session'];
  const rows = logs.map(l => [
    formatTime(l.created_at),
    l.event_type || l.action || '',
    l.actor || l.actor_id || '',
    `${l.target_type || ''} ${l.target_id || ''}`.trim(),
    l.session_id || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reveal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogView({ organizationId, sessionId, isAdmin = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [offset, setOffset] = useState(0);
  const PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAuditLog({
      organization_id: organizationId,
      session_id: sessionId,
      limit: PAGE,
      offset,
    });
    setLogs(data);
    setLoading(false);
  }, [organizationId, sessionId, offset]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    if (filterActor && !(l.actor || '').toLowerCase().includes(filterActor.toLowerCase())) return false;
    if (filterAction && !(l.event_type || l.action || '').toLowerCase().includes(filterAction.toLowerCase())) return false;
    return true;
  });

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>
        Aktivitetslog er kun tilgængelig for admins og GM'er.
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={filterActor}
          onChange={e => setFilterActor(e.target.value)}
          placeholder="Filtrer aktør..."
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 160 }}
        />
        <input
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          placeholder="Filtrer handling..."
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 180 }}
        />
        <button
          onClick={() => exportCSV(filtered)}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', marginLeft: 'auto' }}
        >
          📥 Eksportér CSV
        </button>
      </div>

      {/* Log feed */}
      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: 16 }}>Indlæser...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: 16 }}>Ingen log-poster fundet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map(log => {
            const { icon, color } = actionMeta(log.event_type || log.action);
            const meta = log.metadata || log.payload || {};
            return (
              <div key={log.id} style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr auto',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                alignItems: 'start',
                fontSize: 12,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
                <div>
                  <div style={{ fontWeight: 600, color }}>
                    {log.event_type || log.action || '—'}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>
                    Aktør: <span style={{ color: 'var(--text2)' }}>{log.actor || log.actor_id || 'system'}</span>
                    {log.target_type && <> · {log.target_type}</>}
                    {meta.field && <> · felt: <code style={{ background: 'var(--bg3)', padding: '0 3px', borderRadius: 3 }}>{meta.field}</code></>}
                    {meta.old !== undefined && <> · {JSON.stringify(meta.old)} → {JSON.stringify(meta.new)}</>}
                  </div>
                  {log.session_id && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      Session: {log.session_id.slice(0, 8)}...
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  {formatTime(log.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', fontSize: 12 }}>
        <button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.4 : 1 }}
        >
          ← Forrige
        </button>
        <span style={{ color: 'var(--text3)' }}>Side {Math.floor(offset / PAGE) + 1}</span>
        <button
          disabled={logs.length < PAGE}
          onClick={() => setOffset(offset + PAGE)}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: logs.length < PAGE ? 'default' : 'pointer', opacity: logs.length < PAGE ? 0.4 : 1 }}
        >
          Næste →
        </button>
      </div>
    </div>
  );
}
