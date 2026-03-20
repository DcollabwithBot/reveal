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

export default function Dashboard({ user, onBackToLobby, onContinue, onTimelog }) {
  const displayName = user?.user_metadata?.full_name || user?.email || 'Spiller';
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

  const pending = useMemo(() => approvalRequests.filter((r) => r.state === 'pending_approval').slice(0, 5), [approvalRequests]);
  const approvedReady = useMemo(() => approvalRequests.filter((r) => r.state === 'approved').slice(0, 3), [approvalRequests]);
  const activeProjects = useMemo(() => (dashboard.projects || []).filter((p) => p.status === 'active').slice(0, 4), [dashboard.projects]);
  const recentActivity = useMemo(() => (dashboard.activity || []).slice(0, 5), [dashboard.activity]);

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
        <div style={styles.topbar}>
          <button style={styles.ghostBtn} onClick={onBackToLobby}>← Lobby</button>
          <div style={styles.topbarTitle}>Governance Dashboard · {displayName.split(' ')[0]}</div>
          <button style={styles.primaryBtn} onClick={onContinue}>▶ Continue to game</button>
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
        <DashboardSnapshot activeProjects={activeProjects} recentActivity={recentActivity} onTimelog={onTimelog} />
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Press Start 2P', monospace", position: 'relative', overflow: 'auto', padding: '24px 0' },
  scanlines: { position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 1 },
  panel: { position: 'relative', zIndex: 2, width: '100%', maxWidth: '980px', padding: '28px', background: 'rgba(14, 16, 25, 0.95)', border: '2px solid #7c3aed', boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3)' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' },
  topbarTitle: { fontSize: '8px', color: '#d1d5db' },
  ghostBtn: { padding: '10px 12px', background: 'transparent', border: '1px solid #4b5563', color: '#d1d5db', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', cursor: 'pointer' },
  primaryBtn: { padding: '10px 12px', background: '#4f46e5', border: '1px solid #a78bfa', color: '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', cursor: 'pointer' }
};
