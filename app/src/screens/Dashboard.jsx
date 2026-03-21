import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  applyApprovedRequest,
  applyRequest,
  approveRequest,
  createApprovalRequest,
  createConflictResolutionRequest,
  createProject,
  createRiskItem,
  createSession,
  createSprint,
  createSprintItem,
  getDashboardGovernance,
  getMembership,
  getOrgMetrics,
  getRetroActions,
  getRiskItems,
  getTeamAssignees,
  promoteRetroAction,
  rejectRequest,
  resolveRiskItem,
  startSprintEstimation,
  updateProjectStatus,
  updateRiskItem,
  upsertOrgMetric,
} from '../lib/api';
import GovernanceSummary from '../components/governance/GovernanceSummary';
import GovernanceWorkspace from '../components/governance/GovernanceWorkspace';
import GameStatsBar from '../components/GameStatsBar';
import DailyMissionsCard from '../components/DailyMissionsCard';
import { KpiCard, Pill } from '../components/ui/Card';
import { RoomsSection } from '../components/RoomCard';
import SprintCloseModal from '../components/SprintCloseModal';
import { UserProfileMini } from '../components/UserProfilePanel';
import AuditLogView from '../components/AuditLogView';
import GameHUD from '../components/GameHUD';
import Leaderboard from '../components/leaderboard/Leaderboard';

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

function RiskBand({ riskItems, onAdd, onResolve, onEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', meta: '', assignee_text: '', type: 'risk' });
  const titleRef = useRef(null);

  function openAdd() {
    setForm({ title: '', meta: '', assignee_text: '', type: 'risk' });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function openEdit(item) {
    setForm({ title: item.title, meta: item.meta || '', assignee_text: item.assignee_text || '', type: item.type });
    setEditingId(item.id);
    setShowForm(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editingId) await onEdit(editingId, form);
    else await onAdd(form);
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
          <input ref={titleRef} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Risk / blocker titel..." required style={inputStyle()} />
          <input value={form.meta} onChange={e => setForm(f => ({ ...f, meta: e.target.value }))} placeholder="Beskrivelse / detaljer (valgfri)..." style={inputStyle(12)} />
          <input value={form.assignee_text} onChange={e => setForm(f => ({ ...f, assignee_text: e.target.value }))} placeholder="Ansvarlig / eskaleret til (valgfri)..." style={inputStyle(12)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={selectStyle()}>
              <option value="risk">Risk</option>
              <option value="blocker">Blocker</option>
              <option value="attention">Attention</option>
            </select>
            <button type="submit" style={primaryButton('var(--danger)')}>
              {editingId ? 'Gem ændringer' : 'Tilføj risk'}
            </button>
            <button type="button" onClick={closeForm} style={secondaryButton()}>Annuller</button>
          </div>
        </form>
      )}
    </div>
  );
}

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
    if (!Number.isNaN(n)) {
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
        <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)} placeholder={isPercent ? '0–100' : '0'} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }} style={inputStyle(20, 10, '100%', 6)} />
        <input type="number" value={prev} onChange={e => setPrev(e.target.value)} placeholder="Forrige sprint værdi (valgfri)" style={inputStyle(11, 8, '100%', extraKey ? 6 : 8)} />
        {extraKey && (
          <input type="number" step="0.1" value={extra} onChange={e => setExtra(e.target.value)} placeholder={extraLabel} style={inputStyle(11, 8, '100%', 8)} />
        )}
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={save} style={primaryButton()}>
            Gem
          </button>
          <button onClick={onCancel} style={secondaryButton()}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={open} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', cursor: 'pointer' }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 32, lineHeight: 1, color: color || 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 7 }}>{sub}</div>
    </div>
  );
}

const PROJECT_STATUSES = [
  { value: 'active', label: 'On Track', color: 'var(--jade)' },
  { value: 'review', label: 'Review', color: 'var(--warn)' },
  { value: 'at_risk', label: 'At Risk', color: 'var(--danger)' },
  { value: 'completed', label: 'Completed', color: 'var(--text3)' },
  { value: 'paused', label: 'Paused', color: 'var(--text3)' },
];

function QuickCreatePanel({ projects, assignees, onCreated, onOpenWorkspace }) {
  const [mode, setMode] = useState('project');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    projectName: '', projectDescription: '', projectIcon: '📋', projectColor: '#4488dd',
    sprintProjectId: '', sprintName: '', sprintGoal: '', sprintStatus: 'upcoming',
    itemProjectId: '', itemSprintId: '', itemTitle: '', itemDescription: '', itemPriority: 'medium', itemEstimate: '', itemAssignee: '',
    estimationTaskId: '', estimationTaskTitle: '', estimationMode: 'fibonacci',
    draftCapacity: '', draftEstimationMode: 'quick_estimate', draftItemIds: [],
  });

  const sprintProjectId = form.sprintProjectId || projects[0]?.id || '';
  const itemProjectId = form.itemProjectId || projects[0]?.id || '';
  const sprintOptions = useMemo(() => {
    const project = projects.find(p => p.id === itemProjectId);
    return project?.sprints || [];
  }, [projects, itemProjectId]);

  const backlogItems = useMemo(() => {
    const sprint = sprintOptions.find(s => s.id === form.itemSprintId);
    return (sprint?.items || sprint?.session_items || []);
  }, [sprintOptions, form.itemSprintId]);

  useEffect(() => {
    if (!form.sprintProjectId && projects[0]?.id) setForm(prev => ({ ...prev, sprintProjectId: projects[0].id }));
    if (!form.itemProjectId && projects[0]?.id) setForm(prev => ({ ...prev, itemProjectId: projects[0].id }));
  }, [projects, form.sprintProjectId, form.itemProjectId]);

  useEffect(() => {
    if (!form.itemSprintId && sprintOptions[0]?.id) setForm(prev => ({ ...prev, itemSprintId: sprintOptions[0].id }));
  }, [sprintOptions, form.itemSprintId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'project') {
        const created = await createProject({
          name: form.projectName,
          description: form.projectDescription,
          icon: form.projectIcon,
          color: form.projectColor,
          status: 'active',
        });
        setMsg('Projekt oprettet');
        setForm(prev => ({ ...prev, projectName: '', projectDescription: '' }));
        onCreated?.();
        onOpenWorkspace?.(created.id);
      }

      if (mode === 'sprint') {
        await createSprint(sprintProjectId, {
          name: form.sprintName,
          goal: form.sprintGoal,
          status: form.sprintStatus,
        });
        setMsg('Sprint oprettet');
        setForm(prev => ({ ...prev, sprintName: '', sprintGoal: '' }));
        onCreated?.();
      }

      if (mode === 'item') {
        await createSprintItem(form.itemSprintId, {
          title: form.itemTitle,
          description: form.itemDescription,
          priority: form.itemPriority,
          assigned_to: form.itemAssignee || null,
          estimated_hours: form.itemEstimate ? Number(form.itemEstimate) : null,
          item_status: 'backlog',
          progress: 0,
        });
        setMsg('Opgave oprettet');
        setForm(prev => ({ ...prev, itemTitle: '', itemDescription: '', itemEstimate: '' }));
        onCreated?.();
      }

      if (mode === 'estimation') {
        const targetSprint = sprintOptions.find(s => s.id === form.itemSprintId) || sprintOptions[0] || null;
        const requestedPatch = { final_estimate: null };
        const approval = await createApprovalRequest({
          target_type: 'session_item',
          target_id: form.estimationTaskId,
          requested_patch: requestedPatch,
          idempotency_key: `estimate:${form.estimationTaskId}:${Date.now()}`,
        }).catch(() => null);

        if (approval?.id) {
          await approveRequest(approval.id);
          await applyApprovedRequest(approval.id).catch(() => null);
          await applyRequest(approval.id).catch(() => null);
        }

        await createSession({
          name: `Estimate · ${form.estimationTaskTitle || 'Task'}`,
          session_type: 'estimation',
          voting_mode: form.estimationMode,
          project_id: itemProjectId || null,
          sprint_id: targetSprint?.id || null,
          items: [{ title: form.estimationTaskTitle || 'Task', description: `task_id:${form.estimationTaskId}` }],
        });
        setMsg('Estimation-session oprettet');
      }

      if (mode === 'sprint_draft') {
        const targetSprint = sprintOptions.find(s => s.id === form.itemSprintId) || sprintOptions[0] || null;
        const draftItems = backlogItems.filter(i => form.draftItemIds?.includes(i.id));
        const session = await createSession({
          name: `Sprint Draft · ${targetSprint?.name || 'Sprint'}`,
          session_type: 'sprint_draft',
          project_id: itemProjectId || null,
          sprint_id: targetSprint?.id || null,
          draft_config: {
            target_sprint_id: targetSprint?.id || null,
            capacity_points: Number(form.draftCapacity) || 0,
            estimation_mode: form.draftEstimationMode || 'quick_estimate',
            backlog_item_ids: draftItems.map(i => i.id),
          },
          items: draftItems.map(i => ({ title: i.title, description: i.description || null })),
        });
        if (session?.id) {
          window.history.pushState({}, '', `/sessions/${session.id}/draft`);
          window.location.reload();
        }
        setMsg('Sprint Draft session oprettet');
      }
    } catch (err) {
      setMsg(err.message || 'Fejl');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>Quick Create</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>PM-fladen først. Spillet kobles på opgaven bagefter.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['project', 'Projekt'],
            ['sprint', 'Sprint'],
            ['item', 'Opgave'],
            ['estimation', 'Send til estimering'],
            ['sprint_draft', '🎯 Sprint Draft'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} style={mode === key ? activeChip() : passiveChip()}>{label}</button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10 }}>
        {mode === 'project' && (
          <>
            <input value={form.projectName} onChange={e => setForm(prev => ({ ...prev, projectName: e.target.value }))} placeholder="Projektnavn" required style={gridInput('span 5')} />
            <input value={form.projectDescription} onChange={e => setForm(prev => ({ ...prev, projectDescription: e.target.value }))} placeholder="Kort beskrivelse" style={gridInput('span 5')} />
            <input value={form.projectIcon} onChange={e => setForm(prev => ({ ...prev, projectIcon: e.target.value }))} placeholder="📋" style={gridInput('span 1')} />
            <input type="color" value={form.projectColor} onChange={e => setForm(prev => ({ ...prev, projectColor: e.target.value }))} style={{ ...gridInput('span 1'), padding: 4, minHeight: 40 }} />
          </>
        )}

        {mode === 'sprint' && (
          <>
            <select value={sprintProjectId} onChange={e => setForm(prev => ({ ...prev, sprintProjectId: e.target.value }))} style={gridSelect('span 4')}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <input value={form.sprintName} onChange={e => setForm(prev => ({ ...prev, sprintName: e.target.value }))} placeholder="Sprintnavn" required style={gridInput('span 4')} />
            <select value={form.sprintStatus} onChange={e => setForm(prev => ({ ...prev, sprintStatus: e.target.value }))} style={gridSelect('span 4')}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <input value={form.sprintGoal} onChange={e => setForm(prev => ({ ...prev, sprintGoal: e.target.value }))} placeholder="Sprintmål" style={gridInput('span 12')} />
            {/* E4: Sprint game hints */}
            <div style={{ gridColumn: 'span 12', fontSize: 10, color: 'var(--text3)', padding: '4px 8px', background: 'rgba(200,168,75,0.06)', border: '1px solid rgba(200,168,75,0.18)', borderRadius: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>⚔ Planning Poker anbefales inden sprint start</span>
              <span>🎭 Spec Wars kan hjælpe med kravspecifikation</span>
            </div>
          </>
        )}

        {mode === 'item' && (
          <>
            <select value={itemProjectId} onChange={e => setForm(prev => ({ ...prev, itemProjectId: e.target.value, itemSprintId: '' }))} style={gridSelect('span 3')}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={form.itemSprintId} onChange={e => setForm(prev => ({ ...prev, itemSprintId: e.target.value }))} style={gridSelect('span 3')}>
              {sprintOptions.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
            </select>
            <input value={form.itemTitle} onChange={e => setForm(prev => ({ ...prev, itemTitle: e.target.value }))} placeholder="Opgavetitel" required style={gridInput('span 6')} />
            <input value={form.itemDescription} onChange={e => setForm(prev => ({ ...prev, itemDescription: e.target.value }))} placeholder="Beskrivelse" style={gridInput('span 5')} />
            <select value={form.itemPriority} onChange={e => setForm(prev => ({ ...prev, itemPriority: e.target.value }))} style={gridSelect('span 2')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input value={form.itemEstimate} onChange={e => setForm(prev => ({ ...prev, itemEstimate: e.target.value }))} placeholder="Est. timer" type="number" style={gridInput('span 2')} />
            <select value={form.itemAssignee} onChange={e => setForm(prev => ({ ...prev, itemAssignee: e.target.value }))} style={gridSelect('span 3')}>
              <option value="">Ingen ansvarlig</option>
              {assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
            </select>
            {/* E4: Game readiness hints — ikke-blokerende checklist */}
            <div style={{ gridColumn: 'span 12', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -4 }}>
              {[
                { key: 'ac', icon: '🎭', label: 'Acceptance criteria', hint: 'Kræves af Spec Wars', ok: Boolean(form.itemDescription?.trim()) },
                { key: 'est', icon: '⚔', label: 'Estimate', hint: 'Sæt via Planning Poker', ok: Boolean(form.itemEstimate) },
                { key: 'asg', icon: '📊', label: 'Assigned to', hint: 'Kræves til Perspektiv-Poker', ok: Boolean(form.itemAssignee) },
              ].map(h => (
                <span key={h.key} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: h.ok ? 'rgba(0,200,150,0.08)' : 'rgba(200,168,75,0.07)',
                  border: `1px solid ${h.ok ? 'rgba(0,200,150,0.25)' : 'rgba(200,168,75,0.2)'}`,
                  color: h.ok ? 'var(--jade)' : 'var(--text3)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {h.ok ? '✓' : '○'} {h.icon} {h.label} {!h.ok && <span style={{ opacity: 0.6 }}>— {h.hint}</span>}
                </span>
              ))}
            </div>
          </>
        )}

        {mode === 'estimation' && (
          <>
            <select value={itemProjectId} onChange={e => setForm(prev => ({ ...prev, itemProjectId: e.target.value, itemSprintId: '' }))} style={gridSelect('span 3')}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={form.itemSprintId} onChange={e => setForm(prev => ({ ...prev, itemSprintId: e.target.value }))} style={gridSelect('span 3')}>
              {sprintOptions.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
            </select>
            <select value={form.estimationTaskId} onChange={e => {
              const selected = (sprintOptions.find(s => s.id === form.itemSprintId)?.items || []).find(item => item.id === e.target.value);
              setForm(prev => ({ ...prev, estimationTaskId: e.target.value, estimationTaskTitle: selected?.title || '' }));
            }} style={gridSelect('span 4')}>
              <option value="">Vælg opgave</option>
              {(sprintOptions.find(s => s.id === form.itemSprintId)?.items || []).map(item => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <select value={form.estimationMode} onChange={e => setForm(prev => ({ ...prev, estimationMode: e.target.value }))} style={gridSelect('span 2')}>
              <option value="fibonacci">Fibonacci</option>
              <option value="tshirt">T-shirt</option>
            </select>
          </>
        )}

        {mode === 'sprint_draft' && (
          <>
            <select value={itemProjectId} onChange={e => setForm(prev => ({ ...prev, itemProjectId: e.target.value, itemSprintId: '' }))} style={gridSelect('span 3')}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={form.itemSprintId} onChange={e => setForm(prev => ({ ...prev, itemSprintId: e.target.value }))} style={gridSelect('span 3')}>
              {sprintOptions.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
            </select>
            <input value={form.draftCapacity} onChange={e => setForm(prev => ({ ...prev, draftCapacity: e.target.value }))} placeholder="Capacity (SP)" type="number" style={gridInput('span 3')} />
            <select value={form.draftEstimationMode} onChange={e => setForm(prev => ({ ...prev, draftEstimationMode: e.target.value }))} style={gridSelect('span 3')}>
              <option value="quick_estimate">Quick Estimate</option>
              <option value="strict">Strict (kun estimerede)</option>
            </select>
            {backlogItems.length > 0 && (
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text3)' }}>
                {backlogItems.length} items i valgt sprint — alle tilføjes til draft pool
              </div>
            )}
          </>
        )}

        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: msg?.toLowerCase().includes('fejl') ? 'var(--danger)' : 'var(--text2)' }}>{msg || ' '}</div>
          <button type="submit" disabled={busy} style={primaryButton(undefined, false, busy)}>{busy ? 'Arbejder…' : 'Kør'}</button>
        </div>
      </form>
    </div>
  );
}

function ProjectTable({ projects, onWorkspace, onTimelog, onProjectStatusChange }) {
  if (!projects.length) return <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>Ingen aktive projekter endnu.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px 80px', alignItems: 'center', gap: 14, padding: '8px 18px', background: 'var(--bg3)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
        <span>Projekt</span><span>Fremdrift</span><span>Status</span><span>Sprint</span><span style={{ textAlign: 'right' }}>Items</span>
      </div>
      {projects.map(project => {
        const nextMilestone = project.next_milestone;
        const deadline = daysLeft(nextMilestone?.end_date);
        const owner = project.owner_name || 'Ingen';
        return (
          <div key={project.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px 80px', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--bg2)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: project.color || 'var(--bg3)', display: 'grid', placeItems: 'center', fontSize: 14 }}>{project.icon || '📋'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => onWorkspace(project.id)} style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'var(--text)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>{project.name}</button>
                    <Pill variant={pillVariant(project.status)}>{pillLabel(project.status)}</Pill>
                    {deadline !== null && deadline <= 7 && deadline >= 0 && <span style={{ fontSize: 10, color: 'var(--warn)' }}>D-{deadline}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    <span>{owner}</span>
                    <span>•</span>
                    <span>{project.description || 'Ingen beskrivelse endnu'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ height: 4, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${project.progress || 0}%`, background: statusBarColor(project.status, project.health) }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{project.progress || 0}%</div>
            </div>
            <div>
              <select value={project.status} onChange={e => onProjectStatusChange(project.id, e.target.value)} style={selectStyle()}>
                {PROJECT_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{nextMilestone?.name || '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{project.open_items || 0}/{project.total_items || 0}</span>
              <button onClick={() => onTimelog(project.id)} style={{ fontSize: 11, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 'var(--radius)', padding: '4px 8px', cursor: 'pointer' }}>Timelog</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ onTimelog, onWorkspace, onAnalytics }) {
  const [dashboard, setDashboard] = useState({ active: [], upcoming: [], finished: [], projects: [], activity: [] });
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [health, setHealth] = useState({ queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });
  const [conflicts, setConflicts] = useState([]);
  const [loadingGov, setLoadingGov] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [riskItems, setRiskItems] = useState([]);
  const [orgMetrics, setOrgMetrics] = useState({});
  const [editingMetric, setEditingMetric] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [retroActions, setRetroActions] = useState([]);
  const [retroLoading, setRetroLoading] = useState(false);
  const [promoteModal, setPromoteModal] = useState(null); // { actionId, sprintOptions }
  const [promoteSprint, setPromoteSprint] = useState('');
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [estimateModal, setEstimateModal] = useState(null); // { sprintId, sprintName }
  const [estName, setEstName] = useState('');
  const [estMode, setEstMode] = useState('fibonacci');
  const [estBusy, setEstBusy] = useState(false);
  const [sprintCloseModal, setSprintCloseModal] = useState(null); // { sprintId, sprintName }
  const [activeTab, setActiveTab] = useState('overview'); // E7: tab navigation
  const [isAdmin, setIsAdmin] = useState(false); // E7: admin check

  useEffect(() => {
    refreshGovernance();
    loadRecentItems();
    loadAssignees();
    loadRetroActions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshGovernance() {
    setLoadingGov(true);
    try {
      const membership = await getMembership();
      setOrgId(membership?.organization_id || null);
      // E7: check if user is admin/GM
      if (membership?.role === 'admin' || membership?.role === 'owner' || membership?.role === 'gm') {
        setIsAdmin(true);
      }

      const [{ dashboard: dash, approvalRequests: approvals, health: healthData, conflicts: conflictData }, risks, metrics] = await Promise.all([
        getDashboardGovernance(),
        membership?.organization_id ? getRiskItems(membership.organization_id) : Promise.resolve([]),
        membership?.organization_id ? getOrgMetrics(membership.organization_id) : Promise.resolve([]),
      ]);

      setDashboard(dash || { active: [], upcoming: [], finished: [], projects: [], activity: [] });
      setApprovalRequests(approvals || []);
      setHealth(healthData || { queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });
      setConflicts(conflictData || []);
      setRiskItems(risks || []);
      const metricMap = {};
      for (const metric of metrics || []) metricMap[metric.key] = metric;
      setOrgMetrics(metricMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingGov(false);
    }
  }

  async function loadAssignees() {
    try {
      const data = await getTeamAssignees();
      setAssignees(data || []);
    } catch {
      setAssignees([]);
    }
  }

  async function loadRetroActions() {
    setRetroLoading(true);
    try {
      const data = await getRetroActions();
      setRetroActions(data || []);
    } catch { /* silent */ }
    setRetroLoading(false);
  }

  async function handlePromoteRetro() {
    if (!promoteModal) return;
    setPromoteBusy(true);
    try {
      await promoteRetroAction(promoteModal.actionId, { sprint_id: promoteSprint || null });
      setRetroActions(prev => prev.map(a => a.id === promoteModal.actionId ? { ...a, _promoted: true } : a));
      setPromoteModal(null);
      setPromoteSprint('');
    } catch { /* silent */ }
    setPromoteBusy(false);
  }

  async function handleStartSprintEstimation() {
    if (!estimateModal) return;
    setEstBusy(true);
    try {
      const result = await startSprintEstimation(estimateModal.sprintId, {
        session_name: estName || undefined,
        voting_mode: estMode,
      });
      setEstimateModal(null);
      if (result?.session_id && onWorkspace) {
        // Navigate to lobby — for now just refresh
        window.location.hash = `#/lobby/${result.session_id}`;
      }
    } catch { /* silent */ }
    setEstBusy(false);
  }

  async function handleAddRisk(payload) {
    if (!orgId) return;
    const created = await createRiskItem(orgId, payload);
    if (created) setRiskItems(prev => [created, ...prev]);
  }

  async function handleResolveRisk(id) {
    await resolveRiskItem(id);
    setRiskItems(prev => prev.filter(item => item.id !== id));
  }

  async function handleEditRisk(id, patch) {
    const updated = await updateRiskItem(id, patch);
    if (updated) setRiskItems(prev => prev.map(item => item.id === id ? updated : item));
  }

  async function handleSaveMetric(key, valueNum, prevValueNum) {
    if (!orgId) return;
    const saved = await upsertOrgMetric(orgId, key, valueNum, prevValueNum, null);
    if (saved) setOrgMetrics(prev => ({ ...prev, [key]: { value_num: valueNum, prev_value_num: prevValueNum } }));
    setEditingMetric(null);
  }

  async function loadRecentItems() {
    setRecentLoading(true);
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) return;

      const { data: sprints } = await supabase.from('sprints').select('id, name, project_id').eq('organization_id', membership.organization_id).limit(20);
      const sprintMap = {};
      (sprints || []).forEach(s => { sprintMap[s.id] = s; });

      const { data: projects } = await supabase.from('projects').select('id, name, icon').eq('organization_id', membership.organization_id);
      const projectMap = {};
      (projects || []).forEach(p => { projectMap[p.id] = p; });

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
    } catch {
      // silent
    } finally {
      setRecentLoading(false);
    }
  }

  const pending = useMemo(() => approvalRequests.filter(r => r.state === 'pending_approval').slice(0, 5), [approvalRequests]);
  const approvedReady = useMemo(() => approvalRequests.filter(r => r.state === 'approved').slice(0, 3), [approvalRequests]);
  const activeProjects = useMemo(() => (dashboard.projects || []).filter(p => p.status !== 'completed' && p.status !== 'paused'), [dashboard.projects]);
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
    setDashboard(prev => ({ ...prev, projects: (prev.projects || []).map(p => p.id === projectId ? { ...p, status: newStatus } : p) }));
    try {
      await updateProjectStatus(projectId, newStatus);
    } catch {
      await refreshGovernance();
    }
  }

  const pendingCount = pending.length;
  const blockedCount = orgMetrics.total_blocked?.value_num ?? (health.blocked_writes || 0);
  const confidenceVal = orgMetrics.portfolio_confidence?.value_num ?? null;
  const confidencePrev = orgMetrics.portfolio_confidence?.prev_value_num ?? null;
  const mttrVal = orgMetrics.avg_mttr?.value_num ?? null;
  const atRiskLabel = atRiskCount > 0 ? ` · ${atRiskCount} at risk` : '';
  const blockerLabel = blockedCount > 0 ? ` · ${blockedCount} blokkere` : '';

  return (
    <div style={{ padding: '0', maxWidth: '100%', margin: '0 auto' }}>
      <GameStatsBar />

      {/* Sprint Close Modal */}
      {sprintCloseModal && (
        <SprintCloseModal
          sprintId={sprintCloseModal.sprintId}
          sprintName={sprintCloseModal.sprintName}
          onClose={() => setSprintCloseModal(null)}
          onClosed={() => { refreshGovernance(); }}
        />
      )}

      {/* Estimation Modal */}
      {estimateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center' }} onClick={() => setEstimateModal(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>⚔ Estimer sprint</div>
            <input value={estName} onChange={e => setEstName(e.target.value)} placeholder={estimateModal.sprintName} style={inputStyle(13, 12, '100%', 10)} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['fibonacci', 't-shirt'].map(m => (
                <button key={m} onClick={() => setEstMode(m)} style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', border: 'none',
                  background: estMode === m ? 'var(--jade-dim)' : 'var(--bg3)',
                  color: estMode === m ? 'var(--jade)' : 'var(--text2)',
                  outline: estMode === m ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
                }}>{m === 'fibonacci' ? 'Fibonacci' : 'T-shirt'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleStartSprintEstimation} disabled={estBusy} style={primaryButton('var(--jade)', false, estBusy)}>
                {estBusy ? 'Opretter...' : 'Start session →'}
              </button>
              <button onClick={() => setEstimateModal(null)} style={secondaryButton()}>Annuller</button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Retro Modal */}
      {promoteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center' }} onClick={() => setPromoteModal(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Lav til opgave</div>
            <select value={promoteSprint} onChange={e => setPromoteSprint(e.target.value)} style={{ ...selectStyle(), width: '100%', marginBottom: 14 }}>
              <option value="">Vælg sprint (valgfri)</option>
              {(promoteModal.sprintOptions || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePromoteRetro} disabled={promoteBusy} style={primaryButton('var(--jade)', false, promoteBusy)}>
                {promoteBusy ? 'Sender...' : 'Promovér →'}
              </button>
              <button onClick={() => setPromoteModal(null)} style={secondaryButton()}>Annuller</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '32px', maxWidth: 1140, margin: '0 auto' }}>

      {/* E7: Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'overview', label: '📊 Oversigt' },
          ...(isAdmin ? [{ id: 'audit', label: '📋 Aktivitetslog' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '7px 16px',
              border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer',
              background: activeTab === tab.id ? 'var(--bg2)' : 'none',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text3)',
              borderBottom: activeTab === tab.id ? '2px solid var(--jade)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* E7: Audit Log Tab */}
      {activeTab === 'audit' && (
        <AuditLogView organizationId={orgId} isAdmin={isAdmin} />
      )}

      {activeTab === 'overview' && (
      <div>
      {/* v3.1 Rooms Section */}
      <RoomsSection
        projects={activeProjects}
        onStartSession={(projectId) => {
          // Navigate to estimation for this project
          if (onWorkspace) onWorkspace(projectId);
        }}
        onOpenWorkspace={onWorkspace}
      />

      <QuickCreatePanel projects={activeProjects} assignees={assignees} onCreated={() => { refreshGovernance(); loadRecentItems(); }} onOpenWorkspace={onWorkspace} />

      {/* Daily Missions + KPIs side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiCard label="At Risk" value={atRiskCount + riskItems.length} sub={riskItems.length > 0 ? riskItems.slice(0, 2).map(r => r.title.slice(0, 20)).join(' · ') : 'alt ser godt ud'} color={(atRiskCount + riskItems.length) > 0 ? 'var(--danger)' : 'var(--text)'} />
        <EditableKpiCard label="Total Blocked" value={blockedCount} sub={mttrVal ? `Avg MTTR ${mttrVal}h` : 'blokkerede items'} color={blockedCount > 0 ? 'var(--danger)' : 'var(--text)'} editing={editingMetric === 'blocked'} onEdit={() => setEditingMetric('blocked')} onSave={(val, prev) => handleSaveMetric('total_blocked', val, prev)} onCancel={() => setEditingMetric(null)} extraKey="avg_mttr" extraLabel="Avg MTTR (h)" extraValue={mttrVal} onSaveExtra={(val) => upsertOrgMetric(orgId, 'avg_mttr', val, null, null).then(() => setOrgMetrics(prev => ({ ...prev, avg_mttr: { value_num: val } })))} />
        <EditableKpiCard label="Portfolio Confidence" value={confidenceVal !== null ? `${confidenceVal}%` : '—'} sub={confidencePrev !== null ? `${confidenceVal >= confidencePrev ? '+' : ''}${confidenceVal - confidencePrev}% vs last sprint` : 'klik for at sætte'} color={confidenceVal >= 70 ? 'var(--jade)' : confidenceVal >= 50 ? 'var(--warn)' : 'var(--text)'} editing={editingMetric === 'confidence'} onEdit={() => setEditingMetric('confidence')} onSave={(val, prev) => handleSaveMetric('portfolio_confidence', val, prev)} onCancel={() => setEditingMetric(null)} isPercent />
        <KpiCard label="Pending Approvals" value={pendingCount} sub={pendingCount > 0 ? 'afventer review' : 'all clear'} color={pendingCount > 0 ? 'var(--warn)' : 'var(--text)'} />
        </div>
        {/* E13: Game HUD widget + Daily Missions stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GameHUD
            mode="widget"
            orgId={orgId}
            onNavigate={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />
          <DailyMissionsCard organizationId={orgId} onNavigate={(mission) => { if (onWorkspace && mission.context?.includes('projects:')) onWorkspace(null); }} />
        </div>
      </div>

      <RiskBand riskItems={riskItems} onAdd={handleAddRisk} onResolve={handleResolveRisk} onEdit={handleEditRisk} />

      {/* v3.1 KPI Dashboard link */}
      {onAnalytics && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={onAnalytics}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, padding: '8px 16px',
              background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)',
              borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--jade)',
              transition: 'all 0.15s',
            }}
          >
            📊 Se teamets fremgang →
          </button>
        </div>
      )}

      {/* E14: Sprint Hall of Fame leaderboard */}
      {orgId && (
        <div style={{ marginBottom: 28, padding: '16px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <Leaderboard orgId={orgId} mode="full" showCategoryTabs />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>Active Projects</h2>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>sorteret efter senest opdateret{atRiskLabel || blockerLabel}</span>
      </div>

      <ProjectTable projects={activeProjects} onWorkspace={onWorkspace} onTimelog={onTimelog} onProjectStatusChange={handleProjectStatusChange} />

      <GovernanceSummary health={health} approvedReadyCount={approvedReady.length} />
      <GovernanceWorkspace loading={loadingGov} error={error} pending={pending} approvedReady={approvedReady} conflicts={conflicts} busyId={busyId} onApprove={id => handleAction(id, 'approve')} onReject={id => handleAction(id, 'reject')} onApply={id => handleAction(id, 'apply')} onResolveConflict={handleResolveConflict} />

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>Seneste opgaver</h2>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>på tværs af projekter</span>
        </div>
        {recentLoading && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loader...</div>}
        {!recentLoading && recentItems.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px', gap: 14, padding: '8px 18px', background: 'var(--bg3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>
              <span>Opgave</span><span>Projekt · Sprint</span><span>Status</span><span style={{ textAlign: 'right' }}>Oprettet</span>
            </div>
            {recentItems.map((item, idx) => {
              const statusColor = item.item_status === 'done' ? 'var(--jade)' : item.item_status === 'in_progress' ? 'var(--gold)' : 'var(--text3)';
              const statusLabel = item.item_status === 'done' ? 'Done' : item.item_status === 'in_progress' ? 'In Progress' : 'Backlog';
              const sprintShort = item.sprintName?.replace('Sag ', '') || '—';
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px', gap: 14, padding: '11px 18px', alignItems: 'center', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', background: 'var(--bg2)' }}>
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
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusLabel === 'Done' ? 'rgba(0,200,150,0.1)' : statusLabel === 'In Progress' ? 'rgba(200,168,75,0.1)' : 'var(--bg3)', border: `1px solid ${statusLabel === 'Done' ? 'rgba(0,200,150,0.25)' : statusLabel === 'In Progress' ? 'rgba(200,168,75,0.25)' : 'var(--border)'}`, borderRadius: 10, padding: '2px 8px' }}>{statusLabel}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{new Date(item.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</div>
                </div>
              );
            })}
          </div>
        )}
        {!recentLoading && recentItems.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen opgaver endnu.</div>}
      </div>

      {/* Retro Action Items */}
      {retroActions.filter(a => !a._promoted).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>Retro Action Items</h2>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>fra retrospektiver</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {retroActions.filter(a => !a._promoted).map(action => (
              <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{action.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {action.session_name} · {new Date(action.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    {action.description && <span> · {action.description.slice(0, 60)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const allSprints = (dashboard.projects || []).flatMap(p => p.sprints || []);
                    setPromoteModal({ actionId: action.id, sprintOptions: allSprints });
                    setPromoteSprint(action.suggested_sprint_id || '');
                  }}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid rgba(0,200,150,0.3)', background: 'var(--jade-dim)', color: 'var(--jade)', fontWeight: 600, flexShrink: 0 }}
                >
                  Lav til opgave
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      )}
    </div>
    </div>
  );
}

function inputStyle(fontSize = 13, px = 12, width = 'auto', mb = 0) {
  return { background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize, padding: `8px ${px}px`, outline: 'none', width, marginBottom: mb, boxSizing: 'border-box' };
}

function selectStyle() {
  return { fontSize: 11, padding: '5px 8px', borderRadius: 'var(--radius)', background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', outline: 'none' };
}

function primaryButton(color = 'var(--jade)', flex = true, disabled = false) {
  return { flex: flex ? 1 : 'unset', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius)', background: disabled ? 'var(--bg3)' : color, color: '#fff', border: 'none', cursor: disabled ? 'default' : 'pointer' };
}

function secondaryButton() {
  return { fontSize: 12, padding: '6px 12px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' };
}

function activeChip() {
  return { fontSize: 11, padding: '5px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid rgba(0,200,150,0.3)', background: 'var(--jade-dim)', color: 'var(--jade)' };
}

function passiveChip() {
  return { fontSize: 11, padding: '5px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)' };
}

function gridInput(span) {
  return { ...inputStyle(), gridColumn: span };
}

function gridSelect(span) {
  return { ...selectStyle(), gridColumn: span, minHeight: 40 };
}
