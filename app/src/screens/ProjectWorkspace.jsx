import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getProject, getProjectSprints, getSprintItems, updateItem, startSprintEstimation, startBulkEstimation, createUnplannedItem, getSprintUnplannedStats, bulkImportItems, getImportBatches, undoImportBatch } from '../lib/api';
import { useGameFeature } from '../shared/useGameFeature';
import ItemDetailModal from '../components/ItemDetailModal';
import SprintCharts from '../components/SprintCharts';
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar';
import Toast from '../components/workspace/Toast';
import KanbanColumn from '../components/workspace/KanbanColumn';


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
    } catch { /* ignore */ }
  }

  async function loadBatches() {
    try {
      const batches = await getImportBatches(projectId);
      setImportBatches(batches.filter(b => {
        // Show undo button for 1 hour after import
        const age = Date.now() - new Date(b.created_at).getTime();
        return age < 60 * 60 * 1000;
      }));
    } catch { /* ignore */ }
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

    // Første aktive sprint
    const active = sprintList.find(s => s.status === 'active') || sprintList[0];
    if (active) {
      setActiveSprint(active);
      const sprintItems = await getSprintItems(active.id);
      setItems(sprintItems);
      // Load unplanned stats
      getSprintUnplannedStats(active.id).then(setUnplannedStats).catch(() => {});
    }
    // Load import batches
    getImportBatches(projectId).then(batches => {
      setImportBatches(batches.filter(b => Date.now() - new Date(b.created_at).getTime() < 60 * 60 * 1000));
    }).catch(() => {});
    setLoading(false);
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text2)' }}>
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
        </div>
      </div>

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

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 22 }}>
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
      </div>

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

