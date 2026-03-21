import { useEffect, useState } from 'react';
import { useGameFeature } from '../shared/useGameFeature';
import { getMembership } from '../lib/api';
import { fetchProjectsForOrg, fetchSprintsForProjects, fetchItemsForSprints } from '../lib/helpers/projectHelpers.js';
import NotificationBell from './NotificationBell';

// ── nav-tree inline styles ────────────────────────────────────────────────────
const treeStyles = {
  tree: { padding: '2px 8px 4px 18px', marginTop: 2 },
  item: { fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'default' },
  itemActive: { fontSize: 11, color: 'var(--jade)', display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' },
  dot: { width: 5, height: 5, borderRadius: '50%', background: 'var(--border2)', flexShrink: 0 },
  dotActive: { width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)', flexShrink: 0 },
  sub: { fontSize: 11, color: 'var(--text3)', padding: '1px 0 1px 11px' },
  subSidequest: { fontSize: 11, color: 'var(--epic)', opacity: 0.75, padding: '1px 0 1px 11px' },
};

export default function AppShell({ user, activeScreen, activeProjectId, onNavigate, onWorkspaceNavigate, isLight, toggleTheme, children }) {
  const showGameWidget = useGameFeature('gameWidget');
  const showStreakBadge = useGameFeature('streakBadge');
  const [projects, setProjects] = useState([]);
  const [projectInsights, setProjectInsights] = useState({});

  useEffect(() => {
    async function loadProjects() {
      try {
        const membership = await getMembership();
        if (!membership?.organization_id) return;

        const projs = await fetchProjectsForOrg(membership.organization_id, { statusFilter: 'active' });

        if (!projs.length) return;
        setProjects(projs);

        // Hent sprint + item counts per project
        const sprints = await fetchSprintsForProjects(projs.map(p => p.id), {
          fields: 'id,name,status,project_id',
          statusFilter: 'active',
        });

        const sprintIds = sprints.map(s => s.id);
        let items = [];
        if (sprintIds.length) {
          items = await fetchItemsForSprints(sprintIds, { fields: 'id,item_status,sprint_id' });
        }

        const insights = {};
        for (const proj of projs) {
          const projSprints = (sprints || []).filter(s => s.project_id === proj.id);
          const projSprintIds = projSprints.map(s => s.id);
          const projItems = items.filter(i => projSprintIds.includes(i.sprint_id));
          const activeSprint = projSprints[0];
          insights[proj.id] = {
            sprintName: activeSprint?.name || null,
            totalItems: projItems.length,
            doneItems: projItems.filter(i => i.item_status === 'done').length,
          };
        }
        setProjectInsights(insights);
      } catch (e) {
        // Silent — sidebar projekter er ikke kritisk
      }
    }
    loadProjects();
  }, []);

  const navItems = [
    { id: 'portfolio', label: 'Portfolio', icon: '◈', screen: 'dashboard' },
    { id: 'teamkanban', label: 'Team Kanban', icon: '⊞', screen: 'teamkanban' },
  ];

  const rituals = [
    { id: 'session', label: 'Estimation', icon: '⚡', screen: 'game', badge: { text: 'Join', variant: 'epic' } },
    { id: 'retro', label: 'Retro & Close', icon: '◎', screen: 'retro' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 232, flexShrink: 0,
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0 16px', overflowY: 'auto',
        transition: 'border-color 0.5s, background 0.5s'
      }}>
        {/* Brand */}
        <div style={{ padding: '0 18px 20px', fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          Reveal<span style={{ color: 'var(--jade)', fontStyle: 'italic' }}>.</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text3)', background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>v0.8</span>
        </div>

        {/* Overview nav */}
        <NavSection label="Overview">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeScreen === item.screen || activeScreen === item.id}
              onClick={() => onNavigate(item.screen)}
            />
          ))}
        </NavSection>

        {/* Projects section */}
        {projects.length > 0 && (
          <NavSection label="Projects">
            {projects.map(proj => {
              const insight = projectInsights[proj.id] || {};
              const isActive = activeScreen === 'workspace' && activeProjectId === proj.id;
              return (
                <div key={proj.id}>
                  <NavItem
                    icon={proj.icon || '▸'}
                    label={proj.name}
                    active={isActive}
                    onClick={() => onWorkspaceNavigate ? onWorkspaceNavigate(proj.id) : onNavigate('workspace')}
                  />
                  {insight.sprintName && (
                    <div style={treeStyles.tree}>
                      <div style={isActive ? treeStyles.itemActive : treeStyles.item}>
                        <div style={isActive ? treeStyles.dotActive : treeStyles.dot} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {insight.sprintName}
                        </span>
                      </div>
                      {insight.totalItems > 0 && (
                        <div style={treeStyles.sub}>
                          Tasks ({insight.doneItems}/{insight.totalItems})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </NavSection>
        )}

        {/* Sprint Rituals */}
        <NavSection label="Sprint Rituals">
          {rituals.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeScreen === item.screen || activeScreen === item.id}
              onClick={() => onNavigate(item.screen)}
              badge={item.badge || null}
            />
          ))}
        </NavSection>

        <div style={{ borderTop: '1px solid var(--border)', margin: '14px 18px' }} />

        {/* Timelog shortcut */}
        <div style={{ padding: '0 10px', marginBottom: 2 }}>
          <NavItem
            icon="⏱"
            label="Timelog"
            active={activeScreen === 'timelog'}
            onClick={() => onNavigate('timelog')}
          />
        </div>

        {/* Game Widget */}
        {showGameWidget && (
          <div style={{ margin: 'auto 10px 0', padding: 12, background: 'var(--gold-dim)', border: '1px solid rgba(200,168,75,0.18)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span>⚔️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>Team Level 7</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>2,840 / 4,200 XP</div>
              </div>
              {showStreakBadge && (
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)', background: 'rgba(232,84,84,0.12)', border: '1px solid rgba(232,84,84,0.25)', borderRadius: 16, padding: '3px 8px' }}>🔥 4</span>
                </div>
              )}
            </div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--gold)', borderRadius: 2, width: '68%' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>Next: Lv.8 · Speed Round achievement</div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: isLight ? 'rgba(245,245,247,0.93)' : 'rgba(12,12,15,0.93)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {screenTitle(activeScreen)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reveal'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <NotificationBell onNavigate={(link) => {
              // Navigate to link within the app
              if (link?.startsWith('/projects/')) {
                const projId = link.split('/')[2];
                if (projId && onWorkspaceNavigate) onWorkspaceNavigate(projId);
              } else if (link?.startsWith('/sessions/')) {
                // For now just navigate to dashboard
                onNavigate('dashboard');
              }
            }} />
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer', fontSize: 15, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isLight ? '☾' : '☀︎'}
              </button>
            )}
            <button
              onClick={() => onNavigate('settings')}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, padding: '6px 14px' }}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Content */}
        <div>{children}</div>
      </main>
    </div>
  );
}

function screenTitle(screen) {
  const titles = {
    dashboard: 'Portfolio',
    teamkanban: 'Team Kanban',
    timelog: 'Timelog',
    workspace: 'Project Workspace',
    settings: 'Settings',
    retro: 'Retrospective',
  };
  return titles[screen] || 'Reveal';
}

function NavSection({ label, children }) {
  return (
    <div style={{ padding: '0 10px', marginBottom: 2 }}>
      <div style={{ padding: '0 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4, marginTop: 14 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 9px', borderRadius: 'var(--radius)',
        fontSize: 13, fontWeight: active ? 500 : 400,
        color: active ? 'var(--jade)' : 'var(--text2)',
        background: active ? 'var(--jade-dim)' : 'none',
        border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'background 0.15s, color 0.15s'
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; }}}
    >
      <span style={{ fontSize: 13, opacity: 0.7, flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 600, flexShrink: 0,
          background: badge.variant === 'epic' ? 'var(--epic)' : badge.variant === 'live' ? 'var(--danger)' : 'var(--border2)',
          color: '#fff', borderRadius: 10, padding: '1px 6px', lineHeight: 1.4
        }}>
          {badge.text}
        </span>
      )}
    </button>
  );
}
