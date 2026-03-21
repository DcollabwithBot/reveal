import { handleError } from "../lib/errorHandler";

import { useEffect, useMemo, useRef, useState } from 'react';
import { getMembership, updateItem } from '../lib/api';
import { supabase } from '../lib/supabase';
import { fetchProjectsForOrg, fetchSprintsForProjects, buildAuthHeaders } from '../lib/helpers/projectHelpers.js';
import ItemDetailModal from '../components/ItemDetailModal';

// ── rarity from estimated_hours ───────────────────────────────────────────────
function rarityFromHours(hours) {
  const h = Number(hours) || 0;
  if (h >= 40) return 'epic';
  if (h >= 20) return 'rare';
  if (h >= 8)  return 'uncommon';
  return 'common';
}

const RARITY = {
  common:   { text: 'var(--jade)',   border: 'rgba(0,200,150,0.3)',   bg: 'rgba(0,200,150,0.08)',   label: 'Common' },
  uncommon: { text: 'var(--gold)',   border: 'rgba(200,168,75,0.3)',  bg: 'rgba(200,168,75,0.08)',  label: 'Uncommon' },
  rare:     { text: 'var(--danger)', border: 'rgba(232,84,84,0.3)',   bg: 'rgba(232,84,84,0.06)',   label: 'Rare' },
  epic:     { text: 'var(--epic)',   border: 'rgba(139,92,246,0.3)',  bg: 'rgba(139,92,246,0.08)',  label: 'Epic' },
};

const STATUS_COLS = [
  { key: 'backlog',     label: 'Backlog',      icon: '○', color: 'var(--text3)' },
  { key: 'in_progress', label: 'In Progress',  icon: '◑', color: 'var(--gold)' },
  { key: 'done',        label: 'Done',         icon: '●', color: 'var(--jade)' },
];

function priorityDot(p) {
  if (p === 'high')   return { color: 'var(--danger)', label: '↑' };
  if (p === 'medium') return { color: 'var(--gold)',   label: '→' };
  return { color: 'var(--text3)', label: '↓' };
}

// ── Item card ─────────────────────────────────────────────────────────────────
function KCard({ item, sprintName, projectName, onDragStart, onDragEnd, isDragging, onClick }) {
  const rarity = rarityFromHours(item.estimated_hours);
  const rc = RARITY[rarity];
  const prio = priorityDot(item.priority);
  const hasHours = item.hours_fak > 0 || item.hours_int > 0 || item.hours_ub > 0;
  const hasKm = item.km_driven > 0;
  const progress = Number(item.progress) || 0;
  const blockerCount = item._blocker_count || 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${blockerCount > 0 ? 'var(--danger)' : rc.text}`,
        borderRadius: 'var(--radius)',
        padding: '12px 13px',
        marginBottom: 7,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Top row: rarity + priority + blocker badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: rc.text, background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 10, padding: '1px 7px' }}>
            {rc.label}
          </span>
          {blockerCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: '#fff', background: 'var(--danger)',
              borderRadius: 10, padding: '1px 6px',
            }}>
              🚫 {blockerCount} blocked
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: prio.color, fontWeight: 600 }} title={`Priority: ${item.priority}`}>
          {prio.label}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
        {item.title}
      </div>

      {/* Item code + project/sprint */}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: progress > 0 ? 6 : 0 }}>
        <span style={{ fontFamily: 'var(--mono, monospace)', marginRight: 6 }}>{item.item_code}</span>
        {projectName && <span>{projectName}</span>}
        {sprintName && <span style={{ color: 'var(--text3)' }}> · {sprintName.replace('Sag ', '')}</span>}
      </div>

      {/* Progress bar (hvis > 0) */}
      {progress > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ height: 2, background: 'var(--border2)', borderRadius: 2 }}>
            <div style={{ height: 2, width: `${progress}%`, background: 'var(--jade)', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{progress}%</div>
        </div>
      )}

      {/* Hours breakdown (hvis registreret) */}
      {hasHours && (
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>
          {item.hours_fak > 0 && <span>FAK {item.hours_fak}h</span>}
          {item.hours_int > 0 && <span>INT {item.hours_int}h</span>}
          {item.hours_ub > 0 && <span>UB {item.hours_ub}h</span>}
          {hasKm && <span>🚗 {item.km_driven}km</span>}
        </div>
      )}

      {/* Estimated hours badge */}
      {item.estimated_hours > 0 && (
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Est. {item.estimated_hours}h</span>
          {item.invoiced_dkk > 0 && (
            <span style={{ fontSize: 10, color: 'var(--jade)' }}>
              {(item.invoiced_dkk / 1000).toFixed(0)}k DKK faktureret
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status column ─────────────────────────────────────────────────────────────
function StatusCol({ col, items, sprintMap, projectMap, draggingId, onDragStart, onDragEnd, onDrop, onCardClick, groupBy, wipLimit }) {
  const [isOver, setIsOver] = useState(false);
  const overLimit = typeof wipLimit === 'number' && wipLimit > 0 && items.length > wipLimit;

  return (
    <div
      style={{ flex: '1 1 0', minWidth: 260 }}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => { e.preventDefault(); setIsOver(false); onDrop(col.key); }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, color: col.color }}>{col.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: overLimit ? 'var(--danger)' : 'var(--text3)' }}>{col.label}</span>
          {groupBy && <span style={{ fontSize: 9, color: 'var(--text3)' }}>· {groupBy}</span>}
        </div>
        <span style={{ fontSize: 10, color: overLimit ? 'var(--danger)' : 'var(--text3)', background: overLimit ? 'rgba(232,84,84,0.1)' : 'var(--border)', padding: '2px 7px', borderRadius: 8, border: overLimit ? '1px solid rgba(232,84,84,0.2)' : 'none' }}>
          {items.length}{wipLimit ? `/${wipLimit}` : ''}
        </span>
      </div>

      {/* Drop zone */}
      <div style={{
        minHeight: 40,
        borderRadius: 'var(--radius)',
        background: isOver ? 'var(--jade-dim)' : 'transparent',
        border: isOver ? '1px dashed rgba(0,200,150,0.4)' : '1px dashed transparent',
        transition: 'all 0.15s',
        padding: isOver ? '4px' : '0',
      }}>
        {/* Cards */}
        {items.map(item => (
          <KCard
            key={item.id}
            item={item}
            sprintName={sprintMap[item.sprint_id]?.name}
            projectName={projectMap[sprintMap[item.sprint_id]?.project_id]?.name}
            isDragging={draggingId === item.id}
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick(item)}
          />
        ))}

        {items.length === 0 && !isOver && (
          <div style={{ border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', padding: '20px 16px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
            Ingen items her
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sprint group header ───────────────────────────────────────────────────────
function SprintGroupBar({ sprint, project, itemCount }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 28 }}>
      <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        {project?.icon || '📋'} {sprint.name} · {itemCount} items
      </span>
      <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
    </div>
  );
}

// ── Person swimlane header ────────────────────────────────────────────────────
function PersonSwimlaneBar({ name, inProgressHours }) {
  const color = inProgressHours < 40 ? 'var(--jade)' : inProgressHours < 80 ? 'var(--gold)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 28 }}>
      <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>👤 {name}</span>
        {inProgressHours > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color, background: color === 'var(--jade)' ? 'rgba(0,200,150,0.1)' : color === 'var(--gold)' ? 'rgba(200,168,75,0.1)' : 'rgba(232,84,84,0.1)', border: `1px solid ${color}`, borderRadius: 8, padding: '1px 7px' }}>
            {inProgressHours}h in progress
          </span>
        )}
      </div>
      <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeamKanban() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [sprintMap, setSprintMap] = useState({});
  const [projectMap, setProjectMap] = useState({});
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [filterProjectId, setFilterProjectId] = useState(null);
  // groupMode: 'status' | 'sprint' | 'person' | 'priority'
  const [groupMode, setGroupMode] = useState('status');
  const [wipLimits, setWipLimits] = useState({ backlog: 0, in_progress: 5, done: 0 });
  const [error, setError] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const membership = await getMembership();
        if (!membership?.organization_id) { setLoading(false); return; }
        const orgId = membership.organization_id;

        const projs = await fetchProjectsForOrg(orgId, { statusFilter: 'active' });
        setProjects(projs);
        const pMap = {};
        projs.forEach(p => { pMap[p.id] = p; });
        setProjectMap(pMap);

        const projIds = projs.map(p => p.id);
        let sprintList = [];
        if (projIds.length) {
          sprintList = await fetchSprintsForProjects(projIds, { fields: 'id,name,project_id,status' });
        }
        setSprints(sprintList);
        const sMap = {};
        sprintList.forEach(s => { sMap[s.id] = s; });
        setSprintMap(sMap);

        const sprintIds = sprintList.map(s => s.id);
        if (sprintIds.length) {
          const { data: itemData } = await supabase
            .from('session_items')
            .select('id,title,item_status,progress,priority,estimated_hours,actual_hours,hours_fak,hours_int,hours_ub,km_driven,invoiced_dkk,to_invoice_dkk,item_code,sprint_id,assigned_to,due_date')
            .in('sprint_id', sprintIds)
            .order('item_order', { ascending: true });
          const loadedItems = itemData || [];
          // Fetch blocker counts for items
          if (loadedItems.length) {
            try {
              const itemIds = loadedItems.map(i => i.id);
              const { data: blockers } = await supabase
                .from('item_dependencies')
                .select('item_id')
                .in('item_id', itemIds)
                .eq('dependency_type', 'blocks');
              const blockerCounts = {};
              (blockers || []).forEach(b => {
                blockerCounts[b.item_id] = (blockerCounts[b.item_id] || 0) + 1;
              });
              loadedItems.forEach(item => {
                item._blocker_count = blockerCounts[item.id] || 0;
              });
            } catch (e) { handleError(e, 'load-blocker-counts'); }
          }
          setItems(loadedItems);
        }

        // Hent assignees fra dedikeret endpoint
        try {
          const resp = await fetch('/api/team/assignees', {
            headers: await buildAuthHeaders(),
          });
          if (resp.ok) setAssignees(await resp.json());
        } catch (e) { handleError(e, 'load-assignees'); }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredItems = useMemo(() => {
    if (!filterProjectId) return items;
    return items.filter(i => sprintMap[i.sprint_id]?.project_id === filterProjectId);
  }, [items, filterProjectId, sprintMap]);

  // Sprint groups for grouped view
  const sprintGroups = useMemo(() => {
    const filtered = filterProjectId
      ? sprints.filter(s => s.project_id === filterProjectId)
      : sprints;
    return filtered.map(sprint => ({
      sprint,
      items: filteredItems.filter(i => i.sprint_id === sprint.id),
    })).filter(g => g.items.length > 0);
  }, [sprints, filteredItems, filterProjectId]);

  // Person groups for "By Person" mode
  const personGroups = useMemo(() => {
    // Byg swimlanes fra assignees + Unassigned
    const groups = assignees.map(a => ({
      id: a.id,
      name: a.display_name,
      items: filteredItems.filter(i => i.assigned_to === a.id),
    })).filter(g => g.items.length > 0);

    const unassigned = filteredItems.filter(i => !i.assigned_to);
    if (unassigned.length > 0) {
      groups.push({ id: '__unassigned__', name: 'Unassigned', items: unassigned });
    }
    return groups;
  }, [assignees, filteredItems]);

  // Priority groups
  const PRIORITY_ORDER = ['high', 'medium', 'low'];
  const priorityGroups = useMemo(() => {
    return PRIORITY_ORDER.map(p => ({
      priority: p,
      label: p === 'high' ? '↑ High' : p === 'medium' ? '→ Medium' : '↓ Low',
      items: filteredItems.filter(i => (i.priority || 'low') === p),
    })).filter(g => g.items.length > 0);
  }, [filteredItems]);

  // Stats
  const stats = useMemo(() => {
    const done = filteredItems.filter(i => i.item_status === 'done').length;
    const inProg = filteredItems.filter(i => i.item_status === 'in_progress').length;
    const backlog = filteredItems.filter(i => i.item_status === 'backlog').length;
    const totalHours = filteredItems.reduce((s, i) => s + (Number(i.estimated_hours) || 0), 0);
    const loggedHours = filteredItems.reduce((s, i) => s + (Number(i.hours_fak) || 0) + (Number(i.hours_int) || 0) + (Number(i.hours_ub) || 0), 0);
    return { done, inProg, backlog, total: filteredItems.length, totalHours, loggedHours };
  }, [filteredItems]);

  async function handleDrop(targetStatus) {
    if (!draggingId || !targetStatus) return;
    const item = items.find(i => i.id === draggingId);
    if (!item || item.item_status === targetStatus) return;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === draggingId ? { ...i, item_status: targetStatus } : i));
    try {
      await updateItem(draggingId, { item_status: targetStatus });
    } catch (e) {
      handleError(e, 'update-item-status');
      // Rollback
      setItems(prev => prev.map(i => i.id === draggingId ? { ...i, item_status: item.item_status } : i));
    }
    setDraggingId(null);
  }

  function handleItemUpdated(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
    setSelectedItem(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Loader kanban...</div>;
  if (error) return <div style={{ padding: 32, color: 'var(--danger)', fontSize: 13 }}>Fejl: {error}</div>;

  return (
    <div style={{ padding: 32 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip active={!filterProjectId} onClick={() => setFilterProjectId(null)}>Alle projekter</FilterChip>
          {projects.map(p => (
            <FilterChip key={p.id} active={filterProjectId === p.id} onClick={() => setFilterProjectId(p.id)}>
              {p.icon || '📋'} {p.name}
            </FilterChip>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            WIP
            <input
              type="number"
              min="0"
              value={wipLimits.in_progress}
              onChange={e => setWipLimits(prev => ({ ...prev, in_progress: Number(e.target.value) || 0 }))}
              style={{ width: 52, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
            />
          </label>
          {/* Group mode toggle buttons */}
          {[
            { key: 'status', label: '⊞ Status' },
            { key: 'sprint', label: '⊟ Sprint' },
            { key: 'person', label: '👤 Person' },
            { key: 'priority', label: '↑ Priority' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setGroupMode(opt.key)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', border: 'none',
                background: groupMode === opt.key ? 'var(--jade-dim)' : 'var(--bg3)',
                color: groupMode === opt.key ? 'var(--jade)' : 'var(--text2)',
                outline: groupMode === opt.key ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          ))}
          <SyncChip>Jira —</SyncChip>
          <SyncChip>TopDesk —</SyncChip>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: '12px 18px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <Stat label="Total" value={stats.total} />
        <Stat label="Done" value={stats.done} color="var(--jade)" />
        <Stat label="In Progress" value={stats.inProg} color="var(--gold)" />
        <Stat label="Backlog" value={stats.backlog} />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <Stat label="Est. timer" value={`${stats.totalHours}h`} />
        <Stat label="Logget" value={`${stats.loggedHours.toFixed(1)}h`} color={stats.loggedHours > 0 ? 'var(--jade)' : 'var(--text3)'} />
        <div style={{ flex: 1 }} />
        {stats.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 4, background: 'var(--border2)', borderRadius: 2 }}>
              <div style={{ height: 4, width: `${Math.round(stats.done / stats.total * 100)}%`, background: 'var(--jade)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--jade)' }}>{Math.round(stats.done / stats.total * 100)}%</span>
          </div>
        )}
      </div>

      {/* Kanban body */}
      {groupMode === 'sprint' && (
        sprintGroups.map(({ sprint, items: sprintItems }) => (
          <div key={sprint.id}>
            <SprintGroupBar sprint={sprint} project={projectMap[sprint.project_id]} itemCount={sprintItems.length} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {STATUS_COLS.map(col => (
                <StatusCol
                  key={col.key}
                  col={col}
                  items={sprintItems.filter(i => i.item_status === col.key)}
                  sprintMap={sprintMap}
                  projectMap={projectMap}
                  draggingId={draggingId}
                  onDragStart={id => setDraggingId(id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDrop={handleDrop}
                  onCardClick={setSelectedItem}
                  groupBy={sprint.name}
                  wipLimit={col.key === 'in_progress' ? wipLimits.in_progress : wipLimits[col.key]}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {groupMode === 'person' && (
        personGroups.map(group => {
          const inProgressHours = group.items
            .filter(i => i.item_status === 'in_progress')
            .reduce((s, i) => s + (Number(i.estimated_hours) || 0), 0);
          return (
            <div key={group.id}>
              <PersonSwimlaneBar name={group.name} inProgressHours={inProgressHours} />
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {STATUS_COLS.map(col => (
                  <StatusCol
                    key={col.key}
                    col={col}
                    items={group.items.filter(i => i.item_status === col.key)}
                    sprintMap={sprintMap}
                    projectMap={projectMap}
                    draggingId={draggingId}
                    onDragStart={id => setDraggingId(id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDrop={handleDrop}
                    onCardClick={setSelectedItem}
                    groupBy={group.name}
                    wipLimit={col.key === 'in_progress' ? wipLimits.in_progress : wipLimits[col.key]}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {groupMode === 'priority' && (
        priorityGroups.map(group => (
          <div key={group.priority}>
            <SprintGroupBar
              sprint={{ name: group.label, id: group.priority }}
              project={null}
              itemCount={group.items.length}
            />
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {STATUS_COLS.map(col => (
                <StatusCol
                  key={col.key}
                  col={col}
                  items={group.items.filter(i => i.item_status === col.key)}
                  sprintMap={sprintMap}
                  projectMap={projectMap}
                  draggingId={draggingId}
                  onDragStart={id => setDraggingId(id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDrop={handleDrop}
                  onCardClick={setSelectedItem}
                  groupBy={group.label}
                  wipLimit={col.key === 'in_progress' ? wipLimits.in_progress : wipLimits[col.key]}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {groupMode === 'status' && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {STATUS_COLS.map(col => (
            <StatusCol
              key={col.key}
              col={col}
              items={filteredItems.filter(i => i.item_status === col.key)}
              sprintMap={sprintMap}
              projectMap={projectMap}
              draggingId={draggingId}
              onDragStart={id => setDraggingId(id)}
              onDragEnd={() => setDraggingId(null)}
              onDrop={handleDrop}
              onCardClick={setSelectedItem}
              groupBy={filterProjectId ? (projectMap[filterProjectId]?.name || 'projekt') : 'alle'}
              wipLimit={col.key === 'in_progress' ? wipLimits.in_progress : wipLimits[col.key]}
            />
          ))}
        </div>
      )}

      {filteredItems.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
          Ingen items fundet.
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

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontSize: 16, fontFamily: 'var(--serif)', fontWeight: 400, color: color || 'var(--text)', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>{label}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none',
        background: active ? 'var(--jade-dim)' : 'var(--bg3)',
        color: active ? 'var(--jade)' : 'var(--text2)',
        fontWeight: active ? 600 : 400,
        outline: active ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function SyncChip({ children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
      {children}
    </span>
  );
}
