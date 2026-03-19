import { useEffect, useMemo, useState } from 'react';
import {
  applyRequest,
  approveRequest,
  getDashboardGovernance,
  rejectRequest
} from '../lib/api';

export default function Lobby({ user, onContinue, onGuest }) {
  const displayName = user?.user_metadata?.full_name || user?.email || 'Spiller';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const [loadingGov, setLoadingGov] = useState(true);
  const [error, setError] = useState(null);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [health, setHealth] = useState({ queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });
  const [conflicts, setConflicts] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function refreshGovernance() {
    setLoadingGov(true);
    setError(null);
    try {
      const data = await getDashboardGovernance();
      setApprovalRequests(data.approvalRequests || []);
      setHealth(data.health || { queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });
      setConflicts(data.conflicts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingGov(false);
    }
  }

  useEffect(() => {
    refreshGovernance();
  }, []);

  const pending = useMemo(
    () => approvalRequests.filter((r) => r.state === 'pending_approval').slice(0, 5),
    [approvalRequests]
  );

  const approvedReady = useMemo(
    () => approvalRequests.filter((r) => r.state === 'approved').slice(0, 3),
    [approvalRequests]
  );

  async function handleAction(requestId, action) {
    setBusyId(requestId + action);
    setError(null);
    try {
      if (action === 'approve') await approveRequest(requestId);
      if (action === 'reject') await rejectRequest(requestId, null);
      if (action === 'apply') await applyRequest(requestId);
      await refreshGovernance();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.scanlines} />

      <div style={styles.panel}>
        <div style={styles.titleBlock}>
          <h1 style={styles.title}>REVEAL</h1>
          <p style={styles.subtitle}>Planning Poker RPG</p>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>VELKOMMEN</span>
          <span style={styles.dividerLine} />
        </div>

        <div style={styles.playerCard}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>{displayName.charAt(0).toUpperCase()}</div>
          )}
          <div style={styles.playerInfo}>
            <p style={styles.playerLabel}>SPILLER</p>
            <p style={styles.playerName}>{displayName}</p>
          </div>
        </div>

        <div style={styles.govGrid}>
          <Widget title="Approval Queue" value={health.queue_depth} hint="Pending" />
          <Widget title="Ready to Apply" value={approvedReady.length} hint="Approved" />
          <Widget title="Conflict Center" value={health.blocked_writes} hint="Blocked writes" />
        </div>

        <div style={styles.queueBox}>
          <div style={styles.queueHeader}>
            <span>PM Approval Actions</span>
            <button style={styles.refreshBtn} onClick={refreshGovernance} disabled={loadingGov}>↻</button>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {loadingGov && <div style={styles.muted}>Henter governance data…</div>}

          {!loadingGov && pending.length === 0 && (
            <div style={styles.muted}>Ingen pending approvals 🎉</div>
          )}

          {!loadingGov && pending.map((req) => (
            <div key={req.id} style={styles.queueItem}>
              <div style={styles.queueMeta}>
                <div style={styles.queueTarget}>{req.target_type} · {String(req.target_id).slice(0, 8)}</div>
                <div style={styles.queueState}>{req.state}</div>
              </div>
              <div style={styles.queueActions}>
                <button
                  style={{ ...styles.actionBtn, ...styles.approveBtn }}
                  onClick={() => handleAction(req.id, 'approve')}
                  disabled={Boolean(busyId)}
                >
                  ✅
                </button>
                <button
                  style={{ ...styles.actionBtn, ...styles.rejectBtn }}
                  onClick={() => handleAction(req.id, 'reject')}
                  disabled={Boolean(busyId)}
                >
                  ✖
                </button>
              </div>
            </div>
          ))}

          {!loadingGov && approvedReady.map((req) => (
            <div key={req.id} style={styles.queueItemApproved}>
              <div style={styles.queueMeta}>
                <div style={styles.queueTarget}>{req.target_type} · {String(req.target_id).slice(0, 8)} · klar til apply</div>
                <div style={styles.queueState}>approved</div>
              </div>
              <button
                style={{ ...styles.actionBtn, ...styles.applyBtn }}
                onClick={() => handleAction(req.id, 'apply')}
                disabled={Boolean(busyId)}
              >
                Apply
              </button>
            </div>
          ))}
        </div>

        <div style={styles.conflictBox}>
          <div style={styles.conflictTitle}>Conflict Center v1 (blocked writes)</div>
          {(conflicts || []).slice(0, 3).map((c) => (
            <div key={c.id} style={styles.conflictItem}>
              <span>{c.target_type || 'unknown'}:{String(c.target_id || 'n/a').slice(0, 8)}</span>
              <span>{c.payload?.reason || 'blocked'}</span>
            </div>
          ))}
          {!conflicts?.length && <div style={styles.muted}>Ingen konflikter registreret.</div>}
        </div>

        <button style={styles.continueBtn} onClick={onContinue}>▶ FORTSÆT SOM {displayName.split(' ')[0].toUpperCase()}</button>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>ELLER</span>
          <span style={styles.dividerLine} />
        </div>

        <button style={styles.guestBtn} onClick={onGuest}>👤 SPIL SOM GÆST</button>
        <p style={styles.guestNote}>Som gæst gemmes XP og stats ikke</p>
      </div>
    </div>
  );
}

function Widget({ title, value, hint }) {
  return (
    <div style={styles.widget}>
      <div style={styles.widgetTitle}>{title}</div>
      <div style={styles.widgetValue}>{value}</div>
      <div style={styles.widgetHint}>{hint}</div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace", position: 'relative', overflow: 'auto', padding: '24px 0'
  },
  scanlines: { position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 1 },
  panel: { position: 'relative', zIndex: 2, width: '100%', maxWidth: '760px', padding: '28px', background: 'rgba(14, 16, 25, 0.95)', border: '2px solid #7c3aed', boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3)' },
  titleBlock: { textAlign: 'center', marginBottom: '24px' },
  title: { margin: 0, fontSize: '28px', color: '#a78bfa', textShadow: '0 0 10px rgba(167,139,250,0.8), 2px 2px 0 #4c1d95', letterSpacing: '4px' },
  subtitle: { margin: '8px 0 0', fontSize: '8px', color: '#6b7280', letterSpacing: '2px' },
  divider: { display: 'flex', alignItems: 'center', gap: '8px', margin: '18px 0' },
  dividerLine: { flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #4c1d95, transparent)' },
  dividerText: { fontSize: '8px', color: '#6b7280', letterSpacing: '2px', whiteSpace: 'nowrap' },
  playerCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: '#1a1c2e', border: '1px solid #374151', marginBottom: '16px' },
  avatar: { width: '48px', height: '48px', borderRadius: '2px', border: '2px solid #7c3aed', imageRendering: 'pixelated' },
  avatarPlaceholder: { width: '48px', height: '48px', border: '2px solid #7c3aed', background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#a78bfa' },
  playerInfo: { flex: 1, minWidth: 0 },
  playerLabel: { margin: '0 0 4px', fontSize: '7px', color: '#6b7280', letterSpacing: '2px' },
  playerName: { margin: 0, fontSize: '11px', color: '#e5e7eb' },
  govGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '8px', marginBottom: '12px' },
  widget: { background: '#131629', border: '1px solid #374151', padding: '10px' },
  widgetTitle: { fontSize: '7px', color: '#9ca3af', marginBottom: '6px' },
  widgetValue: { fontSize: '16px', color: '#a78bfa', marginBottom: '4px' },
  widgetHint: { fontSize: '6px', color: '#6b7280' },
  queueBox: { background: '#101425', border: '1px solid #374151', padding: '10px', marginBottom: '10px' },
  queueHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', color: '#d1d5db', marginBottom: '8px' },
  refreshBtn: { background: '#1f2937', color: '#d1d5db', border: '1px solid #4b5563', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', cursor: 'pointer' },
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
  conflictBox: { background: '#120f1f', border: '1px solid #4c1d95', padding: '10px', marginBottom: '16px' },
  conflictTitle: { fontSize: '7px', color: '#c4b5fd', marginBottom: '8px' },
  conflictItem: { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '6px', color: '#d1d5db', padding: '4px 0', borderBottom: '1px solid #2d1d4d' },
  muted: { fontSize: '7px', color: '#6b7280' },
  error: { fontSize: '7px', color: '#fda4af', marginBottom: '8px' },
  continueBtn: { width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #7c3aed 100%)', border: '2px solid #a78bfa', color: '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', cursor: 'pointer', letterSpacing: '1px' },
  guestBtn: { width: '100%', padding: '12px 20px', background: 'transparent', border: '2px solid #374151', color: '#9ca3af', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', cursor: 'pointer', letterSpacing: '1px' },
  guestNote: { margin: '12px 0 0', fontSize: '7px', color: '#4b5563', textAlign: 'center', letterSpacing: '1px', lineHeight: '1.6' }
};
