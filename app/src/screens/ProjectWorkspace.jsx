import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getProject, getProjectSprints, getSprintItems, updateItem, startSprintEstimation, startBulkEstimation, createUnplannedItem, getSprintUnplannedStats, bulkImportItems, getImportBatches, undoImportBatch, startSpecWarsSession, startPerspectivePokerSession, getGameAvailability, updateProjectVisibility } from '../lib/api';
import { useGameFeature } from '../shared/useGameFeature';
import ItemDetailModal from '../components/ItemDetailModal';
import SprintCharts from '../components/SprintCharts';
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar';
import Toast from '../components/workspace/Toast';
import KanbanColumn from '../components/workspace/KanbanColumn';
import VisibilitySelector from '../components/VisibilitySelector';
import GameHUD from '../components/GameHUD';
import { handleError } from "../lib/errorHandler";


export default function ProjectWorkspace({ projectId, organizationId, onBack, onTimelog }) {
  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const showXpBadges = useGameFeature('xpBadges');
  const showRarityStrips = useGameFeature('rarityStrips');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [estModal, setEstModal] = useState(null); // { type: 'sprint'|'bulk', sprintId?, sprintName? }
  const [estName, setEstName] = useState('');
  const [estMode, setEstMode] = useState('fibonacci');
  const [estBusy, setEstBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // Unplanned work
  const [showUnplannedForm, setShowUnplannedForm] = useState(false);
  const [unplannedTitle, setUnplannedTitle] = useState('');
  const [unplannedBusy, setUnplannedBusy] = useState(false);
  const [unplannedStats, setUnplannedStats] = useState(null);

  // Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importBatches, setImportBatches] = useState([]);

  // Game launch
  const [gameBusy, setGameBusy] = useState(false);
  const [showGamesDropdown, setShowGamesDropdown] = useState(false);
  const [gameAvail, setGameAvail] = useState(null);
  const gamesDropRef = useRef(null);

  // Visibility (Mission Shield)
  const [showVisibility, setShowVisibility] = useState(false);
  const [projectVisibility, setProjectVisibility] = useState('public');

  // Workspace tabs
  const [workspaceTab, setWorkspaceTab] = useState('backlog'); // 'backlog' | 'approvals' | 'sessions'

  // Approvals tab
  const [approvals, setApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(null); // requestId being processed

  // Sessions tab
  const [sessionLog, setSessionLog] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null); // session id

  // Column name mapping for smart detection
  const COLUMN_ALIASES = {
    title: ['title', 'titel', 'summary', 'name', 'story', 'opgave', 'task'],
    description: ['description', 'beskrivelse', 'desc', 'details', 'detaljer'],
    estimated_hours: ['estimate', 'hours', 'timer', 'story_points', 'points', 'estimat', 'hours_est'],
    priority: ['priority', 'prioritet', 'prio'],
    item_status: ['status', 'state', 'tilstand'],
    assigned_to: ['assignee', 'assigned', 'tildelt', 'owner', 'ejer'],
  };

  function detectColumns(headers) {
    const mapping = {};
    for (const header of headers) {
      const h = header.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(h) || aliases.some(a => h.includes(a))) {
          mapping[header] = field;
          break;
        }
      }
    }
    return mapping;
  }

  function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] || ''; });
      return row;
    });
    return { headers, rows, mapping: detectColumns(headers) };
  }

  function handleFileDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
      reader.onload = (ev) => {
        const parsed = parseCSV(ev.target.result);
        if (parsed) {
          setImportData(parsed);
          setShowImportModal(true);
        } else {
          setToast('Kunne ikke parse filen');
        }
      };
      reader.readAsText(file);
    } else {
      setToast('Kun CSV/TSV filer understøttes. For Excel: kopier og paste data.');
    }
  }

  function handlePasteImport(text) {
    const parsed = parseCSV(text);
    if (parsed && parsed.rows.length > 0) {
      setImportData(parsed);
      setShowImportModal(true);
    }
  }

  async function handleConfirmImport() {
    if (!importData || !activeSprint) return;
    setImportBusy(true);
    try {
      const mapped = importData.rows.map(row => {
        const item = {};
        for (const [header, field] of Object.entries(importData.mapping)) {
          if (row[header]) item[field] = row[header];
        }
        return item;
      }).filter(item => item.title?.trim());

      const result = await bulkImportItems(activeSprint.id, mapped, 'csv');
      setToast(`✅ Importerede ${result.imported} items`);
      setShowImportModal(false);
      setImportData(null);
      loadData();
      loadBatches();
    } catch (e) {
      setToast(`Import fejl: ${e.message}`);
    }
    setImportBusy(false);
  }

  async function handleAddUnplanned() {
    if (!unplannedTitle.trim() || !activeSprint) return;
    setUnplannedBusy(true);
    try {
      const newItem = await createUnplannedItem(activeSprint.id, { title: unplannedTitle });
      setItems(prev => [...prev, newItem]);
      setUnplannedTitle('');
      setShowUnplannedForm(false);
      setToast('⚡ Uplanlagt opgave tilføjet');
      loadUnplannedStats();
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setUnplannedBusy(false);
  }

  async function handleUndoBatch(batchId) {
    try {
      await undoImportBatch(batchId);
      setToast('Import fortrudt');
      loadData();
      loadBatches();
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
  }

  async function loadUnplannedStats() {
    if (!activeSprint) return;
    try {
      const stats = await getSprintUnplannedStats(activeSprint.id);
      setUnplannedStats(stats);
    } catch (e) { handleError(e, "fetch-data"); }
  }

  async function loadBatches() {
    try {
      const batches = await getImportBatches(projectId);
      setImportBatches(batches.filter(b => {
        // Show undo button for 1 hour after import
        const age = Date.now() - new Date(b.created_at).getTime();
        return age < 60 * 60 * 1000;
      }));
    } catch (e) { handleError(e, "fetch-data"); }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleEstimation() {
    if (!estModal) return;
    setEstBusy(true);
    try {
      let result;
      if (estModal.type === 'sprint') {
        result = await startSprintEstimation(estModal.sprintId, { session_name: estName || undefined, voting_mode: estMode });
      } else {
        result = await startBulkEstimation({ item_ids: [...selectedIds], session_name: estName || undefined, voting_mode: estMode });
      }
      setEstModal(null);
      setSelectedIds(new Set());
      if (result?.session_id) {
        window.location.hash = `#/lobby/${result.session_id}`;
      }
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setEstBusy(false);
  }

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (workspaceTab === 'approvals') loadApprovals();
    if (workspaceTab === 'sessions') loadSessionLog();
  }, [workspaceTab, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Hent team members uafhængigt af organizationId prop — find org via bruger
    loadTeamMembers(organizationId);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTeamMembers(orgId) {
    try {
      let targetOrgId = orgId;

      // Hvis orgId ikke er klar endnu, hent direkte
      if (!targetOrgId) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .maybeSingle();
        targetOrgId = membership?.organization_id;
      }

      if (!targetOrgId) return;

      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', targetOrgId);

      if (members?.length) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        setTeamMembers(profiles || []);
      }
    } catch (err) {
      console.error('[loadTeamMembers]', err);
    }
  }

  async function loadData() {
    setLoading(true);
    const [proj, sprintList] = await Promise.all([
      getProject(projectId),
      getProjectSprints(projectId)
    ]);
    setProject(proj);
    setSprints(sprintList);
    if (proj?.visibility) setProjectVisibility(proj.visibility);

    // Første aktive sprint
    const active = sprintList.find(s => s.status === 'active') || sprintList[0];
    if (active) {
      setActiveSprint(active);
      const sprintItems = await getSprintItems(active.id);
      setItems(sprintItems);
      // Load unplanned stats
      getSprintUnplannedStats(active.id).then(setUnplannedStats).catch(() => {});
      // Load game availability
      getGameAvailability(active.id).then(setGameAvail).catch(() => {});
    }
    // Load import batches
    getImportBatches(projectId).then(batches => {
      setImportBatches(batches.filter(b => Date.now() - new Date(b.created_at).getTime() < 60 * 60 * 1000));
    }).catch(() => {});
    setLoading(false);
  }

  async function loadApprovals() {
    if (!projectId) return;
    setApprovalsLoading(true);
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*, sessions(game_mode, completed_at), session_items(title)')
        .eq('state', 'pending_approval')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) handleError(error, 'load-approvals');
      else setApprovals(data || []);
    } catch (e) { handleError(e, 'load-approvals'); }
    setApprovalsLoading(false);
  }

  async function handleApprovalAction(requestId, action) {
    setApprovalBusy(requestId);
    try {
      const { error } = await supabase.functions.invoke('approve-mutation', {
        body: { approvalId: requestId, action },
      });
      if (error) throw new Error(error.message || 'Ukendt fejl');
      setToast(action === 'approve' ? '✅ Godkendt' : '❌ Afvist');
      await loadApprovals();
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setApprovalBusy(null);
  }

  async function loadSessionLog() {
    if (!projectId) return;
    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, game_mode, status, created_at, completed_at, created_by, summary, items_covered, participants, profiles(display_name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) handleError(error, 'load-sessions');
      else setSessionLog(data || []);
    } catch (e) { handleError(e, 'load-sessions'); }
    setSessionsLoading(false);
  }

  async function handleLaunchSpecWars() {
    if (!activeSprint || gameBusy) return;
    setGameBusy(true);
    try {
      const result = await startSpecWarsSession(activeSprint.id, { name: `Spec Wars — ${activeSprint.name}` });
      if (result?.session_id || result?.id) {
        const sid = result.session_id || result.id;
        window.history.pushState({}, '', `/sessions/${sid}/spec-wars`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setGameBusy(false);
  }

  async function handleLaunchPerspectivePoker() {
    if (!activeSprint || gameBusy) return;
    setGameBusy(true);
    try {
      const result = await startPerspectivePokerSession(activeSprint.id, { name: `Perspektiv-Poker — ${activeSprint.name}` });
      if (result?.session_id || result?.id) {
        const sid = result.session_id || result.id;
        window.history.pushState({}, '', `/sessions/${sid}/perspective-poker`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setGameBusy(false);
  }

  async function handleVisibilityChange(vis) {
    try {
      await updateProjectVisibility(projectId, vis);
      setProjectVisibility(vis);
      setToast(`Synlighed opdateret: ${vis}`);
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
  }

  async function handleSprintChange(sprint) {
    setActiveSprint(sprint);
    const sprintItems = await getSprintItems(sprint.id);
    setItems(sprintItems);
  }

  async function handleDrop(e, targetStatus) {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggingId || !targetStatus) return;
    const item = items.find(i => i.id === draggingId);
    if (!item) return;
    // Optimistisk update på begge felter
    setItems(prev => prev.map(i => i.id === draggingId ? { ...i, item_status: targetStatus, status: targetStatus === 'done' ? 'completed' : targetStatus } : i));
    await updateItem(draggingId, { item_status: targetStatus });
    setDraggingId(null);
  }

  function handleItemUpdated(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
    setSelectedItem(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }

  // Gruppér items — brug item_status primært, fallback til status
  const getStatus = i => i.item_status || i.status;
  const backlog = items.filter(i => { const s = getStatus(i); return s === 'todo' || s === 'backlog' || !s; });
  const inProgress = items.filter(i => { const s = getStatus(i); return s === 'in_progress' || s === 'review' || s === 'active'; });
  const done = items.filter(i => { const s = getStatus(i); return s === 'completed' || s === 'done'; });

  // Burndown simuleret
  const total = items.length;
  const doneCount = done.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Rarity baseret på estimated_hours
  function getRarity(item) {
    const h = item.estimated_hours || 0;
    if (h >= 50) return 'epic';
    if (h >= 20) return 'rare';
    if (h >= 8) return 'uncommon';
    return 'common';
  }

  function rarityColor(r) {
    const colors = { common: 'var(--common)', uncommon: 'var(--uncommon)', rare: 'var(--rare)', epic: 'var(--epic)' };
    return colors[r] || 'var(--common)';
  }

  function xpForItem(item) {
    const h = item.estimated_hours || 0;
    return Math.max(10, Math.round(h * 3));
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Loading...</div>;
  }

  if (!project) {
    return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Project not found.</div>;
  }

  const colDefs = [
    { id: 'backlog', title: 'Backlog', items: backlog, targetStatus: 'backlog', nextStatus: 'in_progress', nextLabel: 'Start →', dimmed: false },
    { id: 'in_progress', title: 'In Progress', titleColor: 'var(--jade)', items: inProgress, targetStatus: 'in_progress', nextStatus: 'completed', nextLabel: 'Done ✓', dimmed: false },
    { id: 'done', title: 'Done', items: done, targetStatus: 'completed', dimmed: true },
  ];

  return (
    <div style={{ padding: 32 }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Estimation Modal */}
      {estModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center' }} onClick={() => setEstModal(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, minWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              {estModal.type === 'sprint' ? '⚔ Estimer sprint' : `⚔ Estimer ${selectedIds.size} items`}
            </div>
            <input value={estName} onChange={e => setEstName(e.target.value)} placeholder="Session navn" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, padding: '8px 12px' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['fibonacci', 't-shirt'].map(m => (
                <button key={m} onClick={() => setEstMode(m)} style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: estMode === m ? 'var(--jade-dim)' : 'var(--bg3)',
                  color: estMode === m ? 'var(--jade)' : 'var(--text2)',
                  outline: estMode === m ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
                }}>{m === 'fibonacci' ? 'Fibonacci' : 'T-shirt'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleEstimation} disabled={estBusy} style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: estBusy ? 'wait' : 'pointer', border: 'none', background: estBusy ? 'var(--bg3)' : 'var(--jade)', color: estBusy ? 'var(--text3)' : '#0c0c0f' }}>
                {estBusy ? 'Opretter...' : 'Start session →'}
              </button>
              <button onClick={() => setEstModal(null)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Annuller</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius)', transition: 'color 0.15s' }}
          >
            ← Portfolio
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: '-0.02em' }}>
            {project.name}
          </div>
          {activeSprint && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', background: 'var(--jade-dim)',
              border: '1px solid rgba(0,200,150,0.22)',
              borderRadius: 16, fontSize: 11, color: 'var(--jade)', fontWeight: 500
            }}>
              {activeSprint.name}
            </span>
          )}
          {activeSprint && (
            <button
              onClick={() => { setEstModal({ type: 'sprint', sprintId: activeSprint.id, sprintName: activeSprint.name }); setEstName(activeSprint.name); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 16, cursor: 'pointer', border: '1px solid rgba(200,168,75,0.3)', background: 'rgba(200,168,75,0.08)', color: 'var(--gold)', fontWeight: 600 }}
            >
              ⚔ Estimer sprint
            </button>
          )}
          {/* E2: Game launch buttons */}
          {activeSprint && (
            <>
              <button
                onClick={handleLaunchSpecWars}
                disabled={gameBusy}
                title={gameAvail?.spec_wars?.reason || 'Spec Wars'}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 16, cursor: gameBusy ? 'wait' : 'pointer',
                  border: '1px solid rgba(180,80,136,0.35)', background: 'rgba(180,80,136,0.09)',
                  color: '#c070a0', fontWeight: 600, opacity: gameBusy ? 0.6 : 1,
                }}
              >
                🎭 Spec Wars
                {gameAvail?.spec_wars?.state === 'recommended' && <span style={{ marginLeft: 3, fontSize: 9 }}>★</span>}
              </button>
              <button
                onClick={handleLaunchPerspectivePoker}
                disabled={gameBusy}
                title={gameAvail?.perspective_poker?.reason || 'Perspektiv-Poker'}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 16, cursor: gameBusy ? 'wait' : 'pointer',
                  border: '1px solid rgba(95,205,228,0.3)', background: 'rgba(95,205,228,0.08)',
                  color: '#5fcde4', fontWeight: 600, opacity: gameBusy ? 0.6 : 1,
                }}
              >
                📊 Perspektiv-Poker
                {gameAvail?.perspective_poker?.state === 'recommended' && <span style={{ marginLeft: 3, fontSize: 9 }}>★</span>}
              </button>
              {/* ▼ Alle spil dropdown */}
              <div style={{ position: 'relative' }} ref={gamesDropRef}>
                <button
                  onClick={() => setShowGamesDropdown(v => !v)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--bg2)',
                    color: 'var(--text2)', fontWeight: 500,
                  }}
                >
                  ▼ Alle spil
                </button>
                {showGamesDropdown && (
                  <div
                    onBlur={() => setShowGamesDropdown(false)}
                    style={{
                      position: 'absolute', top: '110%', right: 0, zIndex: 200,
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: 8, minWidth: 220,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    }}
                  >
                    {[
                      { key: 'planning_poker', icon: '⚔', label: 'Planning Poker', action: () => { setEstModal({ type: 'sprint', sprintId: activeSprint.id, sprintName: activeSprint.name }); setEstName(activeSprint.name); setShowGamesDropdown(false); } },
                      { key: 'spec_wars', icon: '🎭', label: 'Spec Wars', action: () => { handleLaunchSpecWars(); setShowGamesDropdown(false); } },
                      { key: 'perspective_poker', icon: '📊', label: 'Perspektiv-Poker', action: () => { handleLaunchPerspectivePoker(); setShowGamesDropdown(false); } },
                      { key: 'retro', icon: '👾', label: 'Boss Battle Retro', action: null },
                    ].map(g => {
                      const avail = gameAvail?.[g.key];
                      const stateColors = { available: 'var(--jade)', recommended: 'var(--gold)', locked: 'var(--text3)', completed: '#5fcde4' };
                      const stateLabel = { available: '● Klar', recommended: '★ Anbefalet', locked: '🔒 Låst', completed: '✓ Spillet' };
                      return (
                        <button
                          key={g.key}
                          onClick={g.action || undefined}
                          disabled={!g.action || avail?.state === 'locked'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 10px', borderRadius: 6, border: 'none',
                            background: 'none', cursor: g.action && avail?.state !== 'locked' ? 'pointer' : 'default',
                            color: avail?.state === 'locked' ? 'var(--text3)' : 'var(--text)',
                            fontSize: 12, textAlign: 'left', marginBottom: 2,
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{g.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{g.label}</div>
                            {avail && <div style={{ fontSize: 10, color: stateColors[avail.state] || 'var(--text3)' }}>{stateLabel[avail.state] || ''} {avail.reason ? `· ${avail.reason}` : ''}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Visibility (Mission Shield) */}
              <button
                onClick={() => setShowVisibility(v => !v)}
                title={`Synlighed: ${projectVisibility}`}
                style={{
                  fontSize: 11, padding: '4px 8px', borderRadius: 16, cursor: 'pointer',
                  border: '1px solid var(--border)', background: showVisibility ? 'var(--bg3)' : 'none',
                  color: projectVisibility === 'private' ? 'var(--danger)' : projectVisibility === 'restricted' ? 'var(--gold)' : 'var(--text3)',
                }}
              >
                {projectVisibility === 'private' ? '🔒' : projectVisibility === 'restricted' ? '👥' : '🌐'}
              </button>
            </>
          )}
        </div>

        {/* Visibility panel (Mission Shield E6) */}
        {showVisibility && (
          <div style={{
            marginTop: 10, padding: 14, background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 10, maxWidth: 320,
          }}>
            <VisibilitySelector value={projectVisibility} onChange={handleVisibilityChange} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
          <span>{total} items · {doneCount} done · {progress}% complete</span>
          {unplannedStats && unplannedStats.unplannedCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              background: unplannedStats.rate > 0.20 ? 'rgba(232,84,84,0.1)' : 'rgba(200,168,75,0.1)',
              border: `1px solid ${unplannedStats.rate > 0.20 ? 'rgba(232,84,84,0.3)' : 'rgba(200,168,75,0.3)'}`,
              color: unplannedStats.rate > 0.20 ? 'var(--danger)' : 'var(--gold)',
            }}>
              ⚡ Unplanned: {unplannedStats.unplannedCount} ({Math.round(unplannedStats.rate * 100)}%)
            </span>
          )}
          {/* E2: Items without estimate hint */}
          {gameAvail?.meta?.withoutEstimate > 0 && (
            <button
              onClick={() => { setEstModal({ type: 'sprint', sprintId: activeSprint?.id, sprintName: activeSprint?.name }); setEstName(activeSprint?.name || ''); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: 'rgba(200,168,75,0.1)',
                border: '1px solid rgba(200,168,75,0.3)',
                color: 'var(--gold)', cursor: 'pointer',
              }}
            >
              ⚔ {gameAvail.meta.withoutEstimate} items uden estimate → Estimer nu →
            </button>
          )}
        </div>
      </div>

      {/* E13: Game HUD bar */}
      {activeSprint && (
        <div style={{ marginBottom: 14 }}>
          <GameHUD
            mode="bar"
            sprintId={activeSprint.id}
            orgId={organizationId}
            onNavigate={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />
        </div>
      )}

      {/* Sprint selector hvis mere end 1 */}
      {sprints.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {sprints.map(s => (
            <button
              key={s.id}
              onClick={() => handleSprintChange(s)}
              style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500,
                border: '1px solid',
                background: activeSprint?.id === s.id ? 'var(--jade-dim)' : 'none',
                borderColor: activeSprint?.id === s.id ? 'rgba(0,200,150,0.3)' : 'var(--border2)',
                color: activeSprint?.id === s.id ? 'var(--jade)' : 'var(--text2)',
                cursor: 'pointer'
              }}
            >
              {s.sprint_code || s.name}
            </button>
          ))}
        </div>
      )}

      {/* Workspace Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'backlog', label: 'Backlog', icon: '📋' },
          { id: 'approvals', label: 'Godkendelser', icon: '✅', badge: approvals.length > 0 ? approvals.length : null },
          { id: 'sessions', label: 'Sessions', icon: '🎮' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setWorkspaceTab(tab.id)}
            style={{
              position: 'relative',
              fontSize: 12, fontWeight: 600,
              padding: '8px 16px',
              border: 'none', background: 'none', cursor: 'pointer',
              color: workspaceTab === tab.id ? 'var(--jade)' : 'var(--text3)',
              borderBottom: workspaceTab === tab.id ? '2px solid var(--jade)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: 'var(--danger)', color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main grid (Backlog tab) */}
      {workspaceTab === 'backlog' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 22 }}>
        <div>
          {/* Action bar: Unplanned + Import + Undo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setShowUnplannedForm(!showUnplannedForm)}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 16, cursor: 'pointer',
                border: '1px solid rgba(200,168,75,0.3)', background: 'rgba(200,168,75,0.08)',
                color: 'var(--gold)', fontWeight: 600,
              }}
            >
              ⚡ Tilføj uplanlagt opgave
            </button>

            <label style={{
              fontSize: 11, padding: '5px 12px', borderRadius: 16, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'var(--text2)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              📥 Import CSV
              <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFileDrop} />
            </label>

            {importBatches.map(batch => (
              <button
                key={batch.id}
                onClick={() => handleUndoBatch(batch.id)}
                style={{
                  fontSize: 10, padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid rgba(232,84,84,0.3)', background: 'rgba(232,84,84,0.08)',
                  color: 'var(--danger)', fontWeight: 500,
                }}
              >
                ↩ Undo {batch.source_type} import ({batch.items_count} items)
              </button>
            ))}
          </div>

          {/* Unplanned form */}
          {showUnplannedForm && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 14, padding: '10px 14px',
              background: 'var(--bg2)', border: '1px solid var(--gold)', borderRadius: 'var(--radius)',
            }}>
              <input
                value={unplannedTitle}
                onChange={e => setUnplannedTitle(e.target.value)}
                placeholder="Titel på uplanlagt opgave..."
                onKeyDown={e => e.key === 'Enter' && handleAddUnplanned()}
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text)',
                  fontSize: 12, padding: '6px 10px',
                }}
              />
              <button
                onClick={handleAddUnplanned}
                disabled={unplannedBusy || !unplannedTitle.trim()}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius)',
                  cursor: unplannedBusy ? 'wait' : 'pointer', border: 'none',
                  background: 'var(--gold)', color: '#0c0c0f',
                }}
              >
                {unplannedBusy ? '...' : '⚡ Tilføj'}
              </button>
              <button
                onClick={() => { setShowUnplannedForm(false); setUnplannedTitle(''); }}
                style={{
                  fontSize: 11, padding: '6px 10px', borderRadius: 'var(--radius)',
                  cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text2)',
                }}
              >
                Annuller
              </button>
            </div>
          )}

          {/* Import Preview Modal */}
          {showImportModal && importData && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
              display: 'grid', placeItems: 'center',
            }} onClick={() => setShowImportModal(false)}>
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 600, maxWidth: 800,
                maxHeight: '80vh', overflow: 'auto',
              }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📥 Import Preview</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  {importData.rows.length} rækker fundet · Sprint: {activeSprint?.name}
                </div>

                {/* Column mapping */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {importData.headers.map(h => (
                    <span key={h} style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 8,
                      background: importData.mapping[h] ? 'var(--jade-dim)' : 'var(--bg3)',
                      border: `1px solid ${importData.mapping[h] ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
                      color: importData.mapping[h] ? 'var(--jade)' : 'var(--text3)',
                    }}>
                      {h} → {importData.mapping[h] || '(ignored)'}
                    </span>
                  ))}
                </div>

                {/* Preview table */}
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>{Object.values(importData.mapping).map((f, i) => (
                        <th key={i} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{f}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {importData.rows.slice(0, 20).map((row, ri) => {
                        const mapped = {};
                        for (const [h, f] of Object.entries(importData.mapping)) {
                          mapped[f] = row[h];
                        }
                        const valid = mapped.title?.trim();
                        return (
                          <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: valid ? 'transparent' : 'rgba(232,84,84,0.05)' }}>
                            {Object.values(importData.mapping).map((f, ci) => (
                              <td key={ci} style={{ padding: '6px 8px', color: valid ? 'var(--text)' : 'var(--danger)' }}>
                                {mapped[f] || '—'}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {importData.rows.length > 20 && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', padding: 8 }}>...og {importData.rows.length - 20} mere</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleConfirmImport} disabled={importBusy} style={{
                    fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 'var(--radius)',
                    cursor: importBusy ? 'wait' : 'pointer', border: 'none',
                    background: 'var(--jade)', color: '#0c0c0f',
                  }}>
                    {importBusy ? 'Importerer...' : `✅ Import ${importData.rows.length} items`}
                  </button>
                  <button onClick={() => { setShowImportModal(false); setImportData(null); }} style={{
                    fontSize: 12, padding: '8px 14px', borderRadius: 'var(--radius)',
                    cursor: 'pointer', border: '1px solid var(--border)',
                    background: 'var(--bg3)', color: 'var(--text2)',
                  }}>
                    Annuller
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rarity legend */}
          {showRarityStrips && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              <span style={{ color: 'var(--common)' }}>◈ Common</span>
              <span style={{ color: 'var(--uncommon)' }}>◈ Uncommon</span>
              <span style={{ color: 'var(--rare)' }}>◈ Rare</span>
              <span style={{ color: 'var(--epic)' }}>◈ Epic</span>
            </div>
          )}

          {/* Kanban columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {colDefs.map(col => (
              <KanbanColumn
                key={col.id}
                colId={col.id}
                title={col.title}
                titleColor={col.titleColor}
                count={col.items.length}
                items={col.items}
                showXp={showXpBadges && !col.dimmed}
                showRarity={showRarityStrips}
                getRarity={getRarity}
                rarityColor={rarityColor}
                xpForItem={xpForItem}
                dimmed={col.dimmed}
                teamMembers={teamMembers}
                draggingId={draggingId}
                dragOverCol={dragOverCol}
                onDragStart={(id) => setDraggingId(id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.targetStatus)}
                onStatusChange={col.nextStatus ? async (itemId, newStatus) => {
                  setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
                  await updateItem(itemId, { status: newStatus });
                } : null}
                onAssigneeChange={async (itemId, val) => {
                  setItems(prev => prev.map(i => i.id === itemId ? { ...i, assigned_to: val } : i));
                  await updateItem(itemId, { assigned_to: val });
                }}
                onDueDateChange={async (itemId, val) => {
                  setItems(prev => prev.map(i => i.id === itemId ? { ...i, due_date: val } : i));
                  await updateItem(itemId, { due_date: val });
                }}
                nextStatus={col.nextStatus}
                nextLabel={col.nextLabel}
                onCardClick={(item) => setSelectedItem(item)}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                organizationId={organizationId}
              />
            ))}
          </div>

          {/* Floating action bar for bulk estimation */}
          {selectedIds.size > 0 && (
            <div style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 100, display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--bg2)', border: '1px solid var(--jade)',
              borderRadius: 'var(--radius-lg)', padding: '10px 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selectedIds.size} valgt</span>
              <button
                onClick={() => { setEstModal({ type: 'bulk' }); setEstName(`Estimering: ${selectedIds.size} items`); }}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', border: 'none', background: 'var(--jade)', color: '#0c0c0f' }}
              >
                ⚔ Estimer valgte ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)' }}
              >
                Ryd
              </button>
            </div>
          )}

          {/* Charts — Burndown + Velocity */}
          <SprintCharts sprintId={activeSprint?.id} projectId={projectId} />

          {/* Budget Overview */}
          <BudgetOverview items={items} project={project} />
        </div>

        {/* Right sidebar */}
        <WorkspaceSidebar
          progress={progress}
          teamMembers={teamMembers}
          items={items}
          setSelectedItem={setSelectedItem}
          total={total}
          doneCount={doneCount}
          inProgress={inProgress}
          onTimelog={onTimelog}
          projectId={projectId}
        />
      </div>}

      {/* ── Godkendelser tab ─────────────────────────────────── */}
      {workspaceTab === 'approvals' && (
        <div data-tour="workspace-approvals" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Ventende godkendelser
            </div>
            <button
              onClick={loadApprovals}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)' }}
            >
              ↻ Opdatér
            </button>
          </div>

          {approvalsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 24, textAlign: 'center' }}>Indlæser godkendelser...</div>
          ) : approvals.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>Ingen ventende godkendelser 🎉</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Alt er op-to-date</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {approvals.map(req => {
                const sessionMode = req.sessions?.game_mode || '';
                const sessionDate = req.sessions?.completed_at
                  ? new Date(req.sessions.completed_at).toLocaleDateString('da-DK')
                  : req.created_at ? new Date(req.created_at).toLocaleDateString('da-DK') : '—';
                const itemTitle = req.session_items?.title || req.target_id || '—';
                const proposedValue = req.requested_patch
                  ? Object.entries(req.requested_patch).map(([k, v]) => `${k}: ${v}`).join(', ')
                  : '—';
                const isBusy = approvalBusy === req.id;

                return (
                  <div key={req.id} style={{
                    padding: 16, background: 'var(--bg2)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        {itemTitle}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>🎮 {sessionMode || 'Ukendt mode'}</span>
                        <span>📅 {sessionDate}</span>
                        <span style={{ color: 'var(--gold)' }}>📊 {proposedValue}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleApprovalAction(req.id, 'approve')}
                        disabled={isBusy}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius)',
                          cursor: isBusy ? 'wait' : 'pointer', border: 'none',
                          background: isBusy ? 'var(--bg3)' : 'var(--jade)', color: isBusy ? 'var(--text3)' : '#0c0c0f',
                        }}
                      >
                        {isBusy ? '...' : '✅ Godkend'}
                      </button>
                      <button
                        onClick={() => handleApprovalAction(req.id, 'reject')}
                        disabled={isBusy}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius)',
                          cursor: isBusy ? 'wait' : 'pointer',
                          border: '1px solid rgba(232,84,84,0.4)',
                          background: 'rgba(232,84,84,0.08)', color: 'var(--danger)',
                        }}
                      >
                        {isBusy ? '...' : '❌ Afvis'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sessions tab ─────────────────────────────────────── */}
      {workspaceTab === 'sessions' && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Session-historik
            </div>
            <button
              onClick={loadSessionLog}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)' }}
            >
              ↻ Opdatér
            </button>
          </div>

          {sessionsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 24, textAlign: 'center' }}>Indlæser sessions...</div>
          ) : sessionLog.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🗺️</div>
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>Ingen sessions endnu — start en fra World Map</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Sessions vises her efter afslutning</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessionLog.map(sess => {
                const isExpanded = expandedSession === sess.id;
                const relativeDate = sess.created_at ? relativeTime(sess.created_at) : '—';
                const modeLabel = formatGameMode(sess.game_mode);
                const isActive = sess.status === 'active';
                const participantCount = Array.isArray(sess.participants) ? sess.participants.length : 0;
                const itemCount = Array.isArray(sess.items_covered) ? sess.items_covered.length : 0;
                const creator = sess.profiles?.display_name || sess.created_by || '—';

                return (
                  <div key={sess.id} style={{
                    background: 'var(--bg2)',
                    border: `1px solid ${isActive ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                  }}>
                    {/* Session row */}
                    <div
                      onClick={() => setExpandedSession(isExpanded ? null : sess.id)}
                      style={{
                        padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 22, flexShrink: 0 }}>
                        {gameModeIcon(sess.game_mode)}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {modeLabel}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {relativeDate} · af {creator}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {isActive ? (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,200,150,0.12)', color: 'var(--jade)', border: '1px solid rgba(0,200,150,0.3)' }}>● Aktiv</span>
                        ) : (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>Afsluttet</span>
                        )}
                        {itemCount > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{itemCount} items</span>
                        )}
                        <span style={{ fontSize: 14, color: 'var(--text3)' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                        {sess.summary && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10, marginBottom: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)' }}>
                            📝 {sess.summary}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 10 }}>
                          {participantCount > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Deltagere</div>
                              <div style={{ fontSize: 12, color: 'var(--text)' }}>👥 {participantCount} deltagere</div>
                            </div>
                          )}
                          {itemCount > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Items behandlet</div>
                              <div style={{ fontSize: 12, color: 'var(--text)' }}>📋 {itemCount} items</div>
                            </div>
                          )}
                          {sess.completed_at && (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Afsluttet</div>
                              <div style={{ fontSize: 12, color: 'var(--text)' }}>{new Date(sess.completed_at).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={handleItemUpdated}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${days === 1 ? 'dag' : 'dage'} siden`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'time' : 'timer'} siden`;
  if (minutes > 0) return `${minutes} min siden`;
  return 'Lige nu';
}

function formatGameMode(modeId) {
  const labels = {
    planning_poker: 'Planning Poker',
    boss_battle_retro: 'Boss Battle Retro',
    spec_wars: 'Spec Wars',
    perspective_poker: 'Perspektiv-Poker',
    bluff_poker: 'Bluff Poker',
    nesting_scope: 'Russian Nesting Scope',
    speed_scope: 'Speed Scope',
    truth_serum: 'Truth Serum',
    flow_poker: 'Flow Poker',
    risk_poker: 'Risk Poker',
    assumption_slayer: 'Assumption Slayer',
    refinement_roulette: 'Refinement Roulette',
    dependency_mapper: 'Dependency Mapper',
    sprint_draft: 'Sprint Draft',
  };
  return labels[modeId] || modeId || 'Ukendt mode';
}

function gameModeIcon(modeId) {
  const icons = {
    planning_poker: '⚔️', boss_battle_retro: '👾', spec_wars: '🎭',
    perspective_poker: '📊', bluff_poker: '🃏', nesting_scope: '🪆',
    speed_scope: '⚡', truth_serum: '💉', flow_poker: '🌊',
    risk_poker: '🎰', assumption_slayer: '⚔', refinement_roulette: '🎡',
    dependency_mapper: '🗺️', sprint_draft: '📝',
  };
  return icons[modeId] || '🎮';
}

// ── Budget Overview ──────────────────────────────────────────────────────────

function BudgetOverview({ items, project }) {
  const [hourlyRate, setHourlyRate] = useState(null);
  const [editing, setEditing] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load from project metadata
    if (project?.metadata?.hourly_rate) {
      setHourlyRate(project.metadata.hourly_rate);
    }
  }, [project]);

  const estimatedHours = (items || []).reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);
  const actualHours = (items || []).reduce((sum, i) => sum + (Number(i.actual_hours) || 0), 0);
  const estimatedBudget = hourlyRate ? estimatedHours * hourlyRate : null;
  const actualSpend = hourlyRate ? actualHours * hourlyRate : null;
  const variance = estimatedBudget && actualSpend ? actualSpend - estimatedBudget : null;

  async function saveHourlyRate() {
    if (!project?.id || !rateInput) return;
    setSaving(true);
    try {
      const { data: proj } = await supabase.from('projects').select('metadata').eq('id', project.id).single();
      await supabase.from('projects').update({
        metadata: { ...(proj?.metadata || {}), hourly_rate: Number(rateInput) },
      }).eq('id', project.id);
      setHourlyRate(Number(rateInput));
      setEditing(false);
    } catch (e) { handleError(e, "update-hourly-rate"); }
    setSaving(false);
  }

  if (!estimatedHours && !actualHours) return null;

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 18, marginTop: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>
          💰 Budget Oversigt
        </div>
        <button
          onClick={() => { setEditing(true); setRateInput(String(hourlyRate || '')); }}
          style={{ fontSize: 10, color: 'var(--jade)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          {hourlyRate ? `${hourlyRate} kr/t ✎` : '+ Sæt timepris'}
        </button>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input
            type="number"
            value={rateInput}
            onChange={e => setRateInput(e.target.value)}
            placeholder="Timepris i kr."
            autoFocus
            style={{
              fontSize: 13, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)', width: 130,
            }}
          />
          <button
            onClick={saveHourlyRate}
            disabled={saving}
            style={{ fontSize: 11, padding: '6px 12px', background: 'var(--jade)', border: 'none', borderRadius: 'var(--radius)', color: '#000', fontWeight: 600, cursor: 'pointer' }}
          >
            Gem
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ fontSize: 11, padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        <BudgetStat label="Estimeret (timer)" value={`${estimatedHours.toFixed(1)}t`} />
        <BudgetStat label="Faktisk (timer)" value={`${actualHours.toFixed(1)}t`} color={actualHours > estimatedHours ? 'var(--warn)' : 'var(--jade)'} />
        {estimatedBudget != null && <BudgetStat label="Estimeret budget" value={`${Math.round(estimatedBudget).toLocaleString('da-DK')} kr`} />}
        {actualSpend != null && <BudgetStat label="Faktisk forbrug" value={`${Math.round(actualSpend).toLocaleString('da-DK')} kr`} color={actualSpend > estimatedBudget ? 'var(--warn)' : 'var(--jade)'} />}
        {variance != null && (
          <BudgetStat
            label="Afvigelse"
            value={`${variance > 0 ? '+' : ''}${Math.round(variance).toLocaleString('da-DK')} kr`}
            color={variance > 0 ? 'var(--danger)' : 'var(--jade)'}
          />
        )}
      </div>
    </div>
  );
}

function BudgetStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || 'var(--text)', fontFamily: 'var(--serif)', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

