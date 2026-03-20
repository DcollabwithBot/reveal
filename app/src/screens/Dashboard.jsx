import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  applyRequest,
  approveRequest,
  createConflictResolutionRequest,
  getDashboardGovernance,
  getMembership,
  getRiskItems,
  createRiskItem,
  resolveRiskItem,
  updateRiskItem,
  getOrgMetrics,
  upsertOrgMetric,
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
// ── RiskBand — live editable ──────────────────────────────────────────────────
function RiskBand({ riskItems, onAdd, onResolve, onEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', meta: '', assignee_text: '', type: 'risk' });
  const titleRef = useRef(null);

  function openAdd() { setForm({ title: '', meta: '', assignee_text: '', type: 'risk' }); setEditingId(null); setShowForm(true); setTimeout(() => titleRef.current?.focus(), 50); }
  function openEdit(item) { setForm({ title: item.title, meta: item.meta || '', assignee_text: item.assignee_text || '', type: item.type }); setEditingId(item.id); setShowForm(true); setTimeout(() => titleRef.current?.focus(), 50); }
  function closeForm() { setShowForm(false); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editingId) {
      await onEdit(editingId, form);
    } else {
      await onAdd(form);
    }
    closeForm();
  }

  if (!riskItems.length && !showForm) {
    return (
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={openAdd}
          style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', padding: '7px 14px', cursor: 'pointer' }}
        >
          + Tilføj risk / blocker
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(232,84,84,0.18)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: riskItems.length ? 10 : 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--danger)' }}>
          ⚠ {riskItems.length} {riskItems.length === 1 ? 'item kræver' : 'items kræver'} din opmærksomhed
        </div>
        <button onClick={openAdd} style={{ fontSize: 11, color: 'var(--danger)', background: 'rgba(232,84,84,0.12)', border: '1px solid rgba(232,84,84,0.22)', borderRadius: 'var(--radius)', padding: '3px 10px', cursor: 'pointer' }}>
          + Tilføj
        </button>
      </div>

      {riskItems.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(232,84,84,0.10)' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, marginTop: 6 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.title}</div>
            {item.meta && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{item.meta}</div>}
            {item.assignee_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{item.assignee_text}</div>}
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button onClick={() => openEdit(item)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>Redigér</button>
            <button onClick={() => onResolve(item.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)', background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.25)', color: 'var(--jade)', cursor: 'pointer' }}>✓ Løst</button>
          </div>
        </div>
      ))}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ borderTop: '1px solid rgba(232,84,84,0.15)', paddingTop: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={titleRef}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Risk / blocker titel..."
            required
            style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, padding: '8px 12px', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--danger)'}
            onBlur={e => e.target.style.borderColor = 'var(--border2)'}
          />
          <input
            value={form.meta}
            onChange={e => setForm(f => ({ ...f, meta: e.target.value }))}
            placeholder="Beskrivelse / detaljer (valgfri)..."
            style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '7px 12px', outline: 'none' }}
          />
          <input
            value={form.assignee_text}
            onChange={e => setForm(f => ({ ...f, assignee_text: e.target.value }))}
            placeholder="Ansvarlig / eskaleret til (valgfri)..."
            style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '7px 12px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ fontSize: 11, padding: '5px 8px', borderRadius: 'var(--radius)', background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', outline: 'none' }}>
              <option value="risk">Risk</option>
              <option value="blocker">Blocker</option>
              <option value="attention">Attention</option>
            </select>
            <button type="submit" style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '6px', borderRadius: 'var(--radius)', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {editingId ? 'Gem ændringer' : 'Tilføj risk'}
            </button>
            <button type="button" onClick={closeForm} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Annuller</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Editable KPI card ─────────────────────────────────────────────────────────
function EditableKpiCard({ label, value, sub, color, editing, onEdit, onSave, onCancel, isPercent, extraKey, extraLabel, extraValue, onSaveExtra }) {
  const [val, setVal] = useState('');
  const [prev, setPrev] = useState('');
  const [extra, setExtra] = useState('');

  function open() {
    setVal(typeof value === 'string' ? value.replace('%', '') : String(value ?? ''));
    setPrev('');
    setExtra(extraValue ?? '');
    onEdit();
  }

  function save() {
    const n = parseFloat(val);
    const p = parseFloat(prev) || null;
    if (!isNaN(n)) {
      onSave(n, p);
      if (extraKey && onSaveExtra && extra !== '') onSaveExtra(parseFloat(extra) || 0);
    } else {
      onCancel();
    }
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--jade)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>{label}</div>
        <input
          autoFocus
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={isPercent ? '0–100' : '0'}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 20, padding: '6px 10px', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
        />
        <input
          type="number"
          value={prev}
          onChange={e => setPrev(e.target.value)}
          placeholder="Forrige sprint værdi (valgfri)"
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 11, padding: '4px 8px', outline: 'none', marginBottom: extraKey ? 6 : 8, boxSizing: 'border-box' }}
        />
        {extraKey && (
          <input
            type="number"
            step="0.1"
            value={extra}
            onChange={e => setExtra(e.target.value)}
            placeholder={extraLabel}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 11, padding: '4px 8px', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
          />
        )}
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={save} style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '5px', borderRadius: 'var(--radius)', background: 'var(--jade)', color: '#fff', border: 'none', cursor: 'pointer' }}>Gem</button>
          <button onClick={onCancel} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={open}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--jade)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      title="Klik for at redigere"
    >
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 32, lineHeight: 1, color: color || 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 7 }}>{sub}</div>
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
  const [riskItems, setRiskItems] = useState([]);
  const [orgMetrics, setOrgMetrics] = useState({});
  const [orgId, setOrgId] = useState(null);
  const [editingMetric, setEditingMetric] = useState(null); // 'confidence' | 'blocked' | null

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
    loadRiskData();
  }, []); // eslint-disable-line

  async function loadRiskData() {
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) return;
      const oid = membership.organization_id;
      setOrgId(oid);
      const [risks, metrics] = await Promise.all([getRiskItems(oid), getOrgMetrics(oid)]);
      setRiskItems(risks);
      setOrgMetrics(metrics);
    } catch (e) { /* silent */ }
  }

  async function handleAddRisk(form) {
    if (!orgId) return;
    const item = await createRiskItem(orgId, form);
    if (item) setRiskItems(prev => [item, ...prev]);
  }

  async function handleResolveRisk(id) {
    await resolveRiskItem(id);
    setRiskItems(prev => prev.filter(r => r.id !== id));
  }

  async function handleEditRisk(id, form) {
    const updated = await updateRiskItem(id, form);
    if (updated) setRiskItems(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
  }

  async function handleSaveMetric(key, valueNum, prevValueNum) {
    if (!orgId) return;
    const saved = await upsertOrgMetric(orgId, key, valueNum, prevValueNum, null);
    if (saved) setOrgMetrics(prev => ({ ...prev, [key]: { value_num: valueNum, prev_value_num: prevValueNum } }));
    setEditingMetric(null);
  }

  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => { loadRecentItems(); }, []); // eslint-disable-line

  async function loadRecentItems() {
    setRecentLoading(true);
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) return;

      // Hent sprints for org
      const { data: sprints } = await supabase
        .from('sprints')
        .select('id, name, project_id')
        .limit(20);
      const sprintMap = {};
      (sprints || []).forEach(s => { sprintMap[s.id] = s; });

      // Hent projekter
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, icon')
        .eq('organization_id', membership.organization_id);
      const projectMap = {};
      (projects || []).forEach(p => { projectMap[p.id] = p; });

      // Hent senest opdaterede items
      const sprintIds = Object.keys(sprintMap);
      if (!sprintIds.length) return;
      const { data: items } = await supabase
        .from('session_items')
        .select('id, title, item_code, item_status, sprint_id, created_at, priority, estimated_hours')
        .in('sprint_id', sprintIds)
        .order('created_at', { ascending: false })
        .limit(12);

      const enriched = (items || []).map(item => {
        const sprint = sprintMap[item.sprint_id];
        const project = sprint ? projectMap[sprint.project_id] : null;
        return { ...item, sprintName: sprint?.name, projectName: project?.name, projectIcon: project?.icon };
      });
      setRecentItems(enriched);
    } catch (e) { /* silent */ } finally { setRecentLoading(false); }
  }

  const pending = useMemo(() => approvalRequests.filter(r => r.state === 'pending_approval').slice(0, 5), [approvalRequests]);
  const approvedReady = useMemo(() => approvalRequests.filter(r => r.state === 'approved').slice(0, 3), [approvalRequests]);
  const activeProjects = useMemo(() => (dashboard.projects || []).filter(p => p.status === 'active'), [dashboard.projects]);
  const atRiskCount = useMemo(() => (dashboard.projects || []).filter(p => p.status === 'at_risk' || p.health === 'at_risk').length, [dashboard.projects]);

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
  const blockedCount = orgMetrics['total_blocked']?.value_num ?? (health.blocked_writes || 0);
  const confidenceVal = orgMetrics['portfolio_confidence']?.value_num ?? null;
  const confidencePrev = orgMetrics['portfolio_confidence']?.prev_value_num ?? null;
  const mttrVal = orgMetrics['avg_mttr']?.value_num ?? null;
  const healthScore = health.blocked_writes === 0 && health.queue_depth < 5 ? 100 : health.queue_depth < 10 ? 82 : 61;

  const atRiskLabel = atRiskCount > 0 ? ` · ${atRiskCount} at risk` : '';
  const blockerLabel = blockedCount > 0 ? ` · ${blockedCount} blokkere` : '';

  return (
    <div style={{ padding: '32px', maxWidth: 1140, margin: '0 auto' }}>

      {/* ── KPI Grid (V8+ style) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="At Risk"
          value={atRiskCount + riskItems.length}
          sub={riskItems.length > 0 ? riskItems.slice(0, 2).map(r => r.title.slice(0, 20)).join(' · ') : 'alt ser godt ud'}
          color={(atRiskCount + riskItems.length) > 0 ? 'var(--danger)' : 'var(--text)'}
        />
        <EditableKpiCard
          label="Total Blocked"
          value={blockedCount}
          sub={mttrVal ? `Avg MTTR ${mttrVal}h` : 'blokkerede items'}
          color={blockedCount > 0 ? 'var(--danger)' : 'var(--text)'}
          editing={editingMetric === 'blocked'}
          onEdit={() => setEditingMetric('blocked')}
          onSave={(val, prev) => handleSaveMetric('total_blocked', val, prev)}
          onCancel={() => setEditingMetric(null)}
          extraKey="avg_mttr"
          extraLabel="Avg MTTR (h)"
          extraValue={mttrVal}
          onSaveExtra={(val) => upsertOrgMetric(orgId, 'avg_mttr', val, null, null).then(() => setOrgMetrics(prev => ({ ...prev, avg_mttr: { value_num: val } })))}
        />
        <EditableKpiCard
          label="Portfolio Confidence"
          value={confidenceVal !== null ? `${confidenceVal}%` : '—'}
          sub={confidencePrev !== null ? `${confidenceVal >= confidencePrev ? '+' : ''}${confidenceVal - confidencePrev}% vs last sprint` : 'klik for at sætte'}
          color={confidenceVal >= 70 ? 'var(--jade)' : confidenceVal >= 50 ? 'var(--warn)' : 'var(--text)'}
          editing={editingMetric === 'confidence'}
          onEdit={() => setEditingMetric('confidence')}
          onSave={(val, prev) => handleSaveMetric('portfolio_confidence', val, prev)}
          onCancel={() => setEditingMetric(null)}
          isPercent
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingCount}
          sub={pendingCount > 0 ? 'afventer review' : 'all clear'}
          color={pendingCount > 0 ? 'var(--warn)' : 'var(--text)'}
        />
      </div>

      {/* ── Risk Band — live editable ── */}
      <RiskBand
        riskItems={riskItems}
        onAdd={handleAddRisk}
        onResolve={handleResolveRisk}
        onEdit={handleEditRisk}
      />

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

      {/* ── Recent Items ── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
            Seneste opgaver
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>på tværs af projekter</span>
        </div>
        {recentLoading && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loader...</div>}
        {!recentLoading && recentItems.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px', gap: 14, padding: '8px 18px', background: 'var(--bg3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>
              <span>Opgave</span><span>Projekt · Sprint</span><span>Status</span><span style={{ textAlign: 'right' }}>Oprettet</span>
            </div>
            {recentItems.map((item, idx) => {
              const statusColor = item.item_status === 'done' ? 'var(--jade)' : item.item_status === 'in_progress' ? 'var(--gold)' : 'var(--text3)';
              const statusLabel = item.item_status === 'done' ? 'Done' : item.item_status === 'in_progress' ? 'In Progress' : 'Backlog';
              const sprintShort = item.sprintName?.replace('Sag ', '') || '—';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px',
                    gap: 14, padding: '11px 18px', alignItems: 'center',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    background: 'var(--bg2)', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', marginRight: 8 }}>{item.item_code}</span>
                      {item.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.projectIcon || '📋'} {item.projectName || '—'}<br />
                    <span style={{ color: 'var(--text3)' }}>{sprintShort}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusColor === 'var(--jade)' ? 'rgba(0,200,150,0.1)' : statusColor === 'var(--gold)' ? 'rgba(200,168,75,0.1)' : 'var(--bg3)', border: `1px solid ${statusColor === 'var(--jade)' ? 'rgba(0,200,150,0.25)' : statusColor === 'var(--gold)' ? 'rgba(200,168,75,0.25)' : 'var(--border)'}`, borderRadius: 10, padding: '2px 8px' }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                    {new Date(item.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!recentLoading && recentItems.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen opgaver endnu.</div>
        )}
      </div>
    </div>
  );
}
