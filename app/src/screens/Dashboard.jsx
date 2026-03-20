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
import { KpiCard, Pill } from '../components/ui/Card';

export default function Dashboard({ user, onBackToLobby, onContinue, onTimelog, onWorkspace }) {
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

  const totalProjects = (dashboard.projects || []).length;
  const activeCount = (dashboard.projects || []).filter(p => p.status === 'active').length;
  const pendingCount = pending.length;
  const healthScore = health.blocked_writes === 0 && health.queue_depth < 5 ? '100' : health.queue_depth < 10 ? '82' : '61';

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Active Projects" value={activeCount} sub={`${totalProjects} total`} color="var(--jade)" />
        <KpiCard label="Pending Approvals" value={pendingCount} sub={pendingCount > 0 ? 'needs review' : 'all clear'} color={pendingCount > 0 ? 'var(--warn)' : 'var(--text)'} />
        <KpiCard label="Queue Depth" value={health.queue_depth} sub="governance queue" color={health.queue_depth > 5 ? 'var(--danger)' : 'var(--text)'} />
        <KpiCard label="Health Score" value={`${healthScore}%`} sub={health.blocked_writes > 0 ? `${health.blocked_writes} blocked` : 'no blocks'} color={healthScore === '100' ? 'var(--jade)' : healthScore === '82' ? 'var(--warn)' : 'var(--danger)'} />
      </div>

      {/* Governance summary + workspace */}
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

      {/* Projects + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
        {/* Active Projects */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 16 }}>
            Active Projects
          </div>
          {activeProjects.map((project) => {
            const progress = project.progress ?? 0;
            const status = project.status;
            const barColor = status === 'at_risk' ? 'var(--danger)' : status === 'review' ? 'var(--warn)' : 'var(--jade)';
            const pillVariant = status === 'at_risk' ? 'danger' : status === 'review' ? 'warn' : 'jade';
            return (
              <div
                key={project.id}
                onClick={() => onWorkspace && onWorkspace(project.id)}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  cursor: onWorkspace ? 'pointer' : 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 14 }}>
                    {project.icon || '📋'} {project.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Pill variant={pillVariant}>{status}</Pill>
                    {onTimelog && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onTimelog(project.id); }}
                        style={{
                          background: 'var(--jade-dim)', border: '1px solid rgba(0,200,150,0.28)',
                          borderRadius: 'var(--radius)', color: 'var(--jade)',
                          fontSize: 11, padding: '3px 9px', cursor: 'pointer'
                        }}
                      >
                        ⏱ Timelog
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {project.total_items || 0} items · {progress}%
                </div>
                <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2 }}>
                  <div style={{
                    height: 3, borderRadius: 2,
                    width: `${progress}%`,
                    background: barColor,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            );
          })}
          {!activeProjects.length && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen aktive projekter endnu.</div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 16 }}>
            Recent Activity
          </div>
          {recentActivity.map((item) => (
            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.description}</div>
            </div>
          ))}
          {!recentActivity.length && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen aktivitet endnu.</div>
          )}
        </div>
      </div>
    </div>
  );
}
