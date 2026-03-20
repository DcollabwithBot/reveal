import { useEffect, useMemo, useState } from 'react';
import {
  applyRequest,
  approveRequest,
  createConflictResolutionRequest,
  getDashboardGovernance,
  rejectRequest,
  updateProjectStatus
} from '../lib/api';
import GovernanceSummary from '../components/governance/GovernanceSummary';
import GovernanceWorkspace from '../components/governance/GovernanceWorkspace';
import { KpiCard, Pill } from '../components/ui/Card';

// ── helpers ──────────────────────────────────────────────────────────────────
function daysLeft(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function statusBarColor(status, health) {
  if (status === 'at_risk' || health === 'at_risk') return 'var(--danger)';
  if (status === 'review' || health === 'review') return 'var(--warn)';
  return 'var(--jade)';
}

function pillVariant(status) {
  if (status === 'at_risk') return 'danger';
  if (status === 'review') return 'warn';
  return 'jade';
}

function pillLabel(status) {
  if (status === 'at_risk') return 'At Risk';
  if (status === 'review') return 'Review';
  if (status === 'active') return 'On Track';
  if (status === 'completed') return 'Done';
  return status;
}

// ── sub-components ───────────────────────────────────────────────────────────
function RiskBand({ projects, conflicts }) {
  const atRisk = projects.filter(p => p.status === 'at_risk' || p.health === 'at_risk');
  const blocked = conflicts.length;

  if (!atRisk.length && !blocked) return null;

  const items = [
    ...atRisk.map(p => ({
      id: p.id,
      text: `${p.icon || '📋'} ${p.name} er markeret som at risk`,
      meta: p.next_milestone
        ? `Næste milestone: ${p.next_milestone.name} · ${daysLeft(p.next_milestone.end_date) ?? '?'}d tilbage`
        : `${p.done_items || 0}/${p.total_items || 0} items færdige`,
    })),
    ...conflicts.slice(0, 3).map(c => ({
      id: c.id,
      text: `Blokeret write: ${c.target_type} #${String(c.target_id || '').slice(0, 8)}`,
      meta: `Registreret ${new Date(c.created_at).toLocaleDateString('da-DK')} · kræver PM-godkendelse`,
    })),
  ];

  return (
    <div style={{
      background: 'var(--danger-dim)',
      border: '1px solid rgba(232,84,84,0.18)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 22px',
      marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--danger)' }}>
          ⚠ {items.length} {items.length === 1 ? 'item kræver' : 'items kræver'} din opmærksomhed
        </div>
      </div>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderTop: '1px solid rgba(232,84,84,0.08)' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, marginTop: 6 }} />
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.text}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{item.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const PROJECT_STATUSES = [
  { value: 'active',    label: 'On Track',  color: 'var(--jade)' },
  { value: 'review',    label: 'Review',    color: 'var(--warn)' },
  { value: 'at_risk',   label: 'At Risk',   color: 'var(--danger)' },
  { value: 'completed', label: 'Completed', color: 'var(--text3)' },
  { value: 'paused',    label: 'Paused',    color: 'var(--text3)' },
];

function ProjectTable({ projects, onWorkspace, onTimelog, onProjectStatusChange }) {
  if (!projects.length) return (
    <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>Ingen aktive projekter endnu.</div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      background: 'var(--border)', borderRadius: 'var(--radius-lg)',
      overflow: 'hidden', marginBottom: 28,
    }}>
      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px 80px',
        alignItems: 'center', gap: 14, padding: '8px 18px',
        background: 'var(--bg3)',
        fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)',
        cursor: 'default',
      }}>
        <span>Projekt</span><span>Fremdrift</span><span>Status</span><span>Sprint</span><span style={{ textAlign: 'right' }}>Items</span>
      </div>

      {projects.map(project => {
        const progress = project.progress ?? 0;
        const barColor = statusBarColor(project.status, project.health);
        const sprintName = project.next_milestone?.name || '—';
        const days = project.next_milestone ? daysLeft(project.next_milestone.end_date) : null;
        const daysLabel = days === null ? '' : days < 0 ? `${Math.abs(days)}d overskredet` : days === 0 ? 'udløber i dag' : `${days}d tilbage`;
        const daysColor = days !== null && days < 0 ? 'var(--danger)' : days !== null && days <= 3 ? 'var(--warn)' : 'var(--text2)';

        return (
          <div
            key={project.id}
            onClick={() => onWorkspace && onWorkspace(project.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px 80px',
              alignItems: 'center', gap: 14, padding: '14px 18px',
              background: 'var(--bg2)', cursor: onWorkspace ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
          >
            {/* Name + sprint */}
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>
                {project.icon || '📋'} {project.name}
              </div>
              <div style={{ fontSize: 11, color: daysColor, marginTop: 2 }}>
                {sprintName !== '—' ? `${sprintName}${daysLabel ? ` · ${daysLabel}` : ''}` : 'Ingen sprint'}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, marginBottom: 3 }}>
                <div style={{ height: 3, borderRadius: 2, width: `${progress}%`, background: barColor, transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{progress}%</div>
            </div>

            {/* Status select */}
            <div onClick={e => e.stopPropagation()}>
              {(() => {
                const opt = PROJECT_STATUSES.find(s => s.value === project.status) || PROJECT_STATUSES[0];
                return (
                  <select
                    value={project.status}
                    onChange={e => onProjectStatusChange && onProjectStatusChange(project.id, e.target.value)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: 'transparent', border: `1px solid ${opt.color}`,
                      color: opt.color, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {PROJECT_STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                );
              })()}
            </div>

            {/* Sprint label */}
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>
              {sprintName !== '—' ? sprintName.slice(0, 14) : '—'}
            </div>

            {/* Items + timelog */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {project.done_items || 0}/{project.total_items || 0}
              </div>
              {onTimelog && (
                <button
                  onClick={e => { e.stopPropagation(); onTimelog(project.id); }}
                  style={{
                    marginTop: 4,
                    background: 'var(--jade-dim)', border: '1px solid rgba(0,200,150,0.28)',
                    borderRadius: 'var(--radius)', color: 'var(--jade)',
                    fontSize: 10, padding: '2px 7px', cursor: 'pointer',
                  }}
                >⏱</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
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

  useEffect(() => { refreshGovernance(); }, []);

  const pending = useMemo(() => approvalRequests.filter(r => r.state === 'pending_approval').slice(0, 5), [approvalRequests]);
  const approvedReady = useMemo(() => approvalRequests.filter(r => r.state === 'approved').slice(0, 3), [approvalRequests]);
  const activeProjects = useMemo(() => (dashboard.projects || []).filter(p => p.status === 'active'), [dashboard.projects]);
  const atRiskCount = useMemo(() => (dashboard.projects || []).filter(p => p.status === 'at_risk' || p.health === 'at_risk').length, [dashboard.projects]);
  const recentActivity = useMemo(() => (dashboard.activity || []).slice(0, 6), [dashboard.activity]);

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

  async function handleProjectStatusChange(projectId, newStatus) {
    // Optimistisk update
    setDashboard(prev => ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? { ...p, status: newStatus } : p)
    }));
    try {
      await updateProjectStatus(projectId, newStatus);
    } catch {
      // Rollback ved fejl
      await refreshGovernance();
    }
  }

  const totalProjects = (dashboard.projects || []).length;
  const activeCount = activeProjects.length;
  const pendingCount = pending.length;
  const blockedCount = health.blocked_writes || 0;
  const healthScore = blockedCount === 0 && health.queue_depth < 5 ? 100 : health.queue_depth < 10 ? 82 : 61;
  const healthColor = healthScore === 100 ? 'var(--jade)' : healthScore === 82 ? 'var(--warn)' : 'var(--danger)';

  // Topbar subtitle
  const atRiskLabel = atRiskCount > 0 ? ` · ${atRiskCount} at risk` : '';
  const blockerLabel = blockedCount > 0 ? ` · ${blockedCount} blokkere` : '';

  return (
    <div style={{ padding: '32px', maxWidth: 1140, margin: '0 auto' }}>

      {/* ── KPI Grid (V8+ style) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="Active Projects"
          value={activeCount}
          sub={`${totalProjects} total${atRiskLabel}`}
          color="var(--jade)"
        />
        <KpiCard
          label="At Risk"
          value={atRiskCount}
          sub={atRiskCount > 0 ? 'kræver opmærksomhed' : 'alt ser godt ud'}
          color={atRiskCount > 0 ? 'var(--danger)' : 'var(--text)'}
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingCount}
          sub={pendingCount > 0 ? 'afventer review' : 'all clear'}
          color={pendingCount > 0 ? 'var(--warn)' : 'var(--text)'}
        />
        <KpiCard
          label="Portfolio Health"
          value={`${healthScore}%`}
          sub={blockedCount > 0 ? `${blockedCount} blokerede writes` : 'no blocks'}
          color={healthColor}
        />
      </div>

      {/* ── Risk Band (kun hvis der er noget) ── */}
      <RiskBand projects={dashboard.projects || []} conflicts={conflicts} />

      {/* ── Active Projects tabel (V8+ style) ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
          Active Projects
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          sorteret efter senest opdateret{atRiskLabel || blockerLabel}
        </span>
      </div>

      <ProjectTable
        projects={activeProjects}
        onWorkspace={onWorkspace}
        onTimelog={onTimelog}
        onProjectStatusChange={handleProjectStatusChange}
      />

      {/* ── Governance workspace (approval queue, conflicts) ── */}
      <GovernanceSummary health={health} approvedReadyCount={approvedReady.length} />
      <GovernanceWorkspace
        loading={loadingGov}
        error={error}
        pending={pending}
        approvedReady={approvedReady}
        conflicts={conflicts}
        busyId={busyId}
        onApprove={id => handleAction(id, 'approve')}
        onReject={id => handleAction(id, 'reject')}
        onApply={id => handleAction(id, 'apply')}
        onResolveConflict={handleResolveConflict}
      />

      {/* ── Recent Activity ── */}
      {recentActivity.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
              Recent Activity
            </h2>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {recentActivity.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: '13px 20px',
                  borderBottom: idx < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: item.type === 'session' ? 'rgba(0,200,150,0.1)' : 'rgba(100,100,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {item.type === 'session' ? '🎯' : '📋'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{item.description}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
