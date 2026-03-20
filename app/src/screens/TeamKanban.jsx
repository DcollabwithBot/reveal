import { useEffect, useMemo, useState } from 'react';
import { getMembership } from '../lib/api';
import { supabase } from '../lib/supabase';

// ── rarity helpers ────────────────────────────────────────────────────────────
function rarityFromHours(hours) {
  const h = Number(hours) || 0;
  if (h >= 40) return 'epic';
  if (h >= 20) return 'rare';
  if (h >= 8) return 'uncommon';
  return 'common';
}

const RARITY_COLORS = {
  common:   { bg: 'rgba(0,200,150,0.08)',   border: 'rgba(0,200,150,0.25)',   text: 'var(--jade)',   label: 'Common' },
  uncommon: { bg: 'rgba(200,168,75,0.08)',  border: 'rgba(200,168,75,0.25)',  text: 'var(--gold)',   label: 'Uncommon' },
  rare:     { bg: 'rgba(232,84,84,0.06)',   border: 'rgba(232,84,84,0.20)',   text: 'var(--danger)', label: 'Rare' },
  epic:     { bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.22)',  text: 'var(--epic)',   label: 'Epic' },
};

const STATUS_COLORS = {
  done:        'var(--jade)',
  in_progress: 'var(--gold)',
  backlog:     'var(--text3)',
  blocked:     'var(--danger)',
};

function statusLabel(s) {
  if (s === 'in_progress') return 'In Progress';
  if (s === 'done') return 'Done';
  if (s === 'blocked') return 'Blocked';
  return s || 'Backlog';
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: 'rgba(0,200,150,0.15)', color: 'var(--jade)' },
  { bg: 'rgba(139,92,246,0.15)', color: 'var(--epic)' },
  { bg: 'rgba(200,168,75,0.15)', color: 'var(--gold)' },
  { bg: 'rgba(232,84,84,0.12)', color: 'var(--danger)' },
];

// ── Item card ─────────────────────────────────────────────────────────────────
function KCard({ item, sprintName, projectName }) {
  const rarity = rarityFromHours(item.estimated_hours);
  const rc = RARITY_COLORS[rarity];
  const statusColor = STATUS_COLORS[item.item_status] || 'var(--text3)';

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid var(--border)`,
      borderLeft: `3px solid ${rc.text}`,
      borderRadius: 'var(--radius)', padding: '12px 13px',
      marginBottom: 7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: rc.text, background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 10, padding: '1px 7px' }}>
          {rc.label}
        </span>
        <span style={{ fontSize: 10, color: statusColor }}>{statusLabel(item.item_status)}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8, lineHeight: 1.4 }}>
        {item.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          {projectName ? `${projectName} · ` : ''}{sprintName || item.item_code || ''}
        </span>
        {item.estimated_hours > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>{item.estimated_hours}h</span>
        )}
      </div>
      {(item.hours_fak > 0 || item.hours_int > 0 || item.hours_ub > 0) && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
          FAK {item.hours_fak || 0}h · INT {item.hours_int || 0}h · UB {item.hours_ub || 0}h
        </div>
      )}
    </div>
  );
}

// ── Person column ─────────────────────────────────────────────────────────────
function PersonCol({ person, items, sprintMap, projectMap, colorIdx, overloadedNames }) {
  const colors = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
  const totalHours = items.reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);
  const doneHours = items.filter(i => i.item_status === 'done').reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);
  const MAX_HOURS = 160; // ~1 måned
  const workloadPct = Math.min(Math.round((totalHours / MAX_HOURS) * 100), 150);
  const isOverloaded = workloadPct > 100;
  const workloadColor = isOverloaded ? 'var(--danger)' : workloadPct > 80 ? 'var(--warn)' : 'var(--jade)';
  const overloadedColleague = overloadedNames.find(n => n !== person.display_name);

  return (
    <div style={{ minWidth: 260, maxWidth: 320 }}>
      {/* Person header */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: colors.bg, color: colors.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, position: 'relative',
          }}>
            {initials(person.display_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{person.display_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 7 }}>
              {items.length} item{items.length !== 1 ? 's' : ''} · {totalHours}h estimeret
            </div>
            {/* Workload bar */}
            <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
              <div style={{ height: '100%', width: `${Math.min(workloadPct, 100)}%`, background: workloadColor, borderRadius: 2, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: workloadColor }}>
              {isOverloaded ? `⚠ ${workloadPct}% — overloaded` : `${workloadPct}% capacity`}
            </div>
          </div>
        </div>
      </div>

      {/* Overload banner */}
      {isOverloaded && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(232,84,84,0.2)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 8, fontSize: 11, color: 'var(--danger)' }}>
          ⚠ Overloaded — overvej at flytte opgaver videre
        </div>
      )}

      {/* Rebalance hint */}
      {!isOverloaded && workloadPct < 60 && overloadedColleague && (
        <div style={{ background: 'var(--jade-dim)', border: '1px dashed rgba(0,200,150,0.25)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 11, color: 'var(--jade)', marginBottom: 8 }}>
          💡 {overloadedColleague} er overloaded — kapacitet tilgængelig her
        </div>
      )}

      {/* Items */}
      {items.map(item => (
        <KCard
          key={item.id}
          item={item}
          sprintName={sprintMap[item.sprint_id]?.name}
          projectName={projectMap[sprintMap[item.sprint_id]?.project_id]?.name}
        />
      ))}

      {/* Empty drop zone */}
      {items.length === 0 && (
        <div style={{ border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
          Ingen items tildelt
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TeamKanban() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);      // { id, display_name }
  const [items, setItems] = useState([]);           // session_items
  const [sprintMap, setSprintMap] = useState({});   // id → sprint
  const [projectMap, setProjectMap] = useState({}); // id → project
  const [projects, setProjects] = useState([]);
  const [filterProjectId, setFilterProjectId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const membership = await getMembership();
        if (!membership?.organization_id) { setLoading(false); return; }
        const orgId = membership.organization_id;

        // 1. Members + profiles
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', orgId);

        const userIds = (orgMembers || []).map(m => m.user_id);
        let profiles = [];
        if (userIds.length) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);
          profiles = profileData || [];
        }
        setMembers(profiles.length ? profiles : [{ id: 'unassigned', display_name: 'Unassigned' }]);

        // 2. Projects
        const { data: projs } = await supabase
          .from('projects')
          .select('id, name, icon, status')
          .eq('organization_id', orgId)
          .eq('status', 'active');
        setProjects(projs || []);
        const pMap = {};
        (projs || []).forEach(p => { pMap[p.id] = p; });
        setProjectMap(pMap);

        // 3. Sprints
        const projIds = (projs || []).map(p => p.id);
        let sprints = [];
        if (projIds.length) {
          const { data: sprintData } = await supabase
            .from('sprints')
            .select('id, name, project_id, status')
            .in('project_id', projIds);
          sprints = sprintData || [];
        }
        const sMap = {};
        sprints.forEach(s => { sMap[s.id] = s; });
        setSprintMap(sMap);

        // 4. Items
        const sprintIds = sprints.map(s => s.id);
        if (sprintIds.length) {
          const { data: itemData } = await supabase
            .from('session_items')
            .select('id, title, item_status, estimated_hours, hours_fak, hours_int, hours_ub, assigned_to, sprint_id, item_code, priority')
            .in('sprint_id', sprintIds)
            .order('item_order', { ascending: true });
          setItems(itemData || []);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Items per member: assigned_to match, else put on first member (fallback)
  const itemsByMember = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id] = []; });

    const filteredItems = filterProjectId
      ? items.filter(i => sprintMap[i.sprint_id]?.project_id === filterProjectId)
      : items;

    for (const item of filteredItems) {
      const assignee = item.assigned_to;
      if (assignee && map[assignee]) {
        map[assignee].push(item);
      } else {
        // Fallback: første member
        const firstId = members[0]?.id;
        if (firstId) map[firstId] = [...(map[firstId] || []), item];
      }
    }
    return map;
  }, [items, members, filterProjectId, sprintMap]);

  const overloadedNames = useMemo(() => {
    return members
      .filter(m => {
        const memberItems = itemsByMember[m.id] || [];
        const totalHours = memberItems.reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);
        return totalHours / 160 > 1;
      })
      .map(m => m.display_name);
  }, [members, itemsByMember]);

  if (loading) return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Loader team data...</div>;
  if (error) return <div style={{ padding: 32, color: 'var(--danger)', fontSize: 13 }}>Fejl: {error}</div>;

  return (
    <div style={{ padding: 32 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip active={!filterProjectId} onClick={() => setFilterProjectId(null)}>
            Alle projekter
          </FilterChip>
          {projects.map(p => (
            <FilterChip key={p.id} active={filterProjectId === p.id} onClick={() => setFilterProjectId(p.id)}>
              {p.icon || '📋'} {p.name}
            </FilterChip>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sync:</span>
          <SyncChip variant="none">Jira —</SyncChip>
          <SyncChip variant="none">TopDesk —</SyncChip>
          <SyncChip variant="none">DevOps —</SyncChip>
        </div>
      </div>

      {/* Kanban grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
        {members.map((member, idx) => (
          <PersonCol
            key={member.id}
            person={member}
            items={itemsByMember[member.id] || []}
            sprintMap={sprintMap}
            projectMap={projectMap}
            colorIdx={idx}
            overloadedNames={overloadedNames}
          />
        ))}
      </div>

      {members.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
          Ingen teammedlemmer fundet. Invitér folk til dit workspace for at se team kanban.
        </div>
      )}
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

function SyncChip({ variant, children }) {
  const colors = {
    jira:    { bg: 'rgba(38,132,255,0.1)', color: '#2684ff', border: 'rgba(38,132,255,0.25)' },
    topdesk: { bg: 'rgba(255,140,0,0.1)',  color: '#ff8c00', border: 'rgba(255,140,0,0.25)' },
    devops:  { bg: 'rgba(0,114,198,0.1)',  color: '#0072c6', border: 'rgba(0,114,198,0.25)' },
    none:    { bg: 'var(--bg3)',           color: 'var(--text3)', border: 'var(--border)' },
  };
  const c = colors[variant] || colors.none;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {children}
    </span>
  );
}
