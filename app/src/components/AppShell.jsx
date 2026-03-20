import { useGameFeature } from '../shared/useGameFeature';

export default function AppShell({ user, activeScreen, onNavigate, isLight, toggleTheme, children }) {
  const showGameWidget = useGameFeature('gameWidget');
  const showStreakBadge = useGameFeature('streakBadge');

  const navItems = [
    { id: 'portfolio', label: 'Portfolio', icon: '◈', screen: 'dashboard' },
    { id: 'teamkanban', label: 'Team Kanban', icon: '⊞', screen: 'teamkanban' },
  ];

  const rituals = [
    { id: 'session', label: 'Estimation', icon: '⚡', screen: 'game' },
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
              active={activeScreen === item.screen}
              onClick={() => onNavigate(item.screen)}
            />
          ))}
        </NavSection>

        {/* Sprint Rituals */}
        <NavSection label="Sprint Rituals">
          {rituals.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeScreen === item.screen}
              onClick={() => onNavigate(item.screen)}
              badge={item.id === 'session' ? { text: 'Join', variant: 'epic' } : null}
            />
          ))}
        </NavSection>

        <div style={{ borderTop: '1px solid var(--border)', margin: '14px 18px' }} />

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
        <div>
          {children}
        </div>
      </main>
    </div>
  );
}

function screenTitle(screen) {
  const titles = {
    dashboard: 'Portfolio',
    teamkanban: 'Team Kanban',
    timelog: 'Timelog',
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
    >
      <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>
      {label}
      {badge && (
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 600,
          background: badge.variant === 'epic' ? 'var(--epic)' : 'var(--danger)',
          color: '#fff', borderRadius: 10, padding: '1px 5px', lineHeight: 1.4
        }}>
          {badge.text}
        </span>
      )}
    </button>
  );
}
