import { useEffect, useMemo, useState } from 'react';
import {
  applyRequest,
  approveRequest,
  createConflictResolutionRequest,
  getDashboardGovernance,
  rejectRequest
} from '../lib/api';
import GovernanceSummary from '../components/governance/GovernanceSummary';
import GovernanceWorkspace from '../components/governance/GovernanceWorkspace';
import DashboardSnapshot from '../components/governance/DashboardSnapshot';

export default function Lobby({ user, onContinue, onGuest }) {
  const displayName = user?.user_metadata?.full_name || user?.email || 'Spiller';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const [loadingGov, setLoadingGov] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState({ active: [], upcoming: [], finished: [], projects: [], activity: [] });
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [health, setHealth] = useState({ queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });
  const [conflicts, setConflicts] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function refreshGovernance() {
    setLoadingGov(true);
    setError(null);
    try {
      const data = await getDashboardGovernance();
      setDashboard(data.dashboard || { active: [], upcoming: [], finished: [], projects: [], activity: [] });
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

  const activeProjects = useMemo(
    () => (dashboard.projects || []).filter((p) => p.status === 'active').slice(0, 4),
    [dashboard.projects]
  );

  const recentActivity = useMemo(
    () => (dashboard.activity || []).slice(0, 5),
    [dashboard.activity]
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

  async function handleResolveConflict(conflict) {
    setBusyId(`conflict-${conflict.id}`);
    setError(null);
    try {
      await createConflictResolutionRequest(conflict);
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

        <GovernanceSummary health={health} approvedReadyCount={approvedReady.length} />

        <GovernanceWorkspace
          loading={loadingGov}
          error={error}
          pending={pending}
          approvedReady={approvedReady}
          conflicts={conflicts}
          busyId={busyId}
          onApprove={(id) => handleAction(id, 'approve')}
          onReject={(id) => handleAction(id, 'reject')}
          onApply={(id) => handleAction(id, 'apply')}
          onResolveConflict={handleResolveConflict}
        />

        <DashboardSnapshot activeProjects={activeProjects} recentActivity={recentActivity} />

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

const styles = {
  container: {
    minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace", position: 'relative', overflow: 'auto', padding: '24px 0'
  },
  scanlines: { position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 1 },
  panel: { position: 'relative', zIndex: 2, width: '100%', maxWidth: '980px', padding: '28px', background: 'rgba(14, 16, 25, 0.95)', border: '2px solid #7c3aed', boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3)' },
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
  continueBtn: { width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #7c3aed 100%)', border: '2px solid #a78bfa', color: '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', cursor: 'pointer', letterSpacing: '1px' },
  guestBtn: { width: '100%', padding: '12px 20px', background: 'transparent', border: '2px solid #374151', color: '#9ca3af', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', cursor: 'pointer', letterSpacing: '1px' },
  guestNote: { margin: '12px 0 0', fontSize: '7px', color: '#4b5563', textAlign: 'center', letterSpacing: '1px', lineHeight: '1.6' }
};
