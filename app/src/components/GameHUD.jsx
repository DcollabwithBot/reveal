/**
 * GameHUD — Visuelt game dashboard widget til PM Board (Sprint E13)
 *
 * Modes:
 *   bar    — smal status-bar under sprint-header (ProjectWorkspace)
 *   widget — sidebar-widget (Dashboard)
 *
 * Props:
 *   mode         'bar' | 'widget'
 *   sprintId     string | null
 *   orgId        string | null
 *   onNavigate   () => void  — fører til World Map
 */

import { useState, useEffect } from 'react';
import { getGameStats, getCurrentUserProfile, getUserMissions } from '../lib/api';
import Leaderboard from './leaderboard/Leaderboard';

// XP → level (simpel tabel)
function xpToLevel(xp = 0) {
  const thresholds = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000];
  let lv = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) lv = i + 1;
  }
  const next = thresholds[lv] || 9999;
  const prev = thresholds[lv - 1] || 0;
  const pct = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100));
  return { level: lv, pct, next };
}

// Mini pixel avatar
function PixelAvatar({ avatarClass, size = 20 }) {
  const color = avatarClass?.color || '#f04f78';
  const icon = avatarClass?.icon || '⚔️';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '33', border: `2px solid ${color}88`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.48, flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

// ── BAR MODE ─────────────────────────────────────────────────────────────────
function GameHUDBar({ profile, missions, onNavigate, onExpand }) {
  const { level, pct } = xpToLevel(profile?.xp || 0);
  const activeMissions = (missions || []).filter(m => m.status === 'active');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 12px', background: 'rgba(0,0,0,0.12)',
      borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
      fontSize: 11, flexWrap: 'wrap',
    }}>
      {/* Avatar + Level */}
      <button
        onClick={onExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        title="Vis game status"
      >
        <PixelAvatar avatarClass={profile?.avatar_class} size={20} />
        <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 10 }}>Lv.{level}</span>
      </button>

      {/* XP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 60, height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 3, transition: 'width 0.6s ease' }} />
        </div>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>{profile?.xp || 0} XP</span>
      </div>

      {/* Active missions count */}
      {activeMissions.length > 0 && (
        <button
          onClick={onExpand}
          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '1px solid rgba(0,200,150,0.3)', background: 'rgba(0,200,150,0.07)', color: 'var(--jade)', cursor: 'pointer', fontWeight: 600 }}
          title="Vis aktive missions"
        >
          🎯 {activeMissions.length} missions
        </button>
      )}

      {/* World Map link */}
      <button
        onClick={onNavigate}
        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '1px solid rgba(200,168,75,0.3)', background: 'none', color: 'var(--gold)', cursor: 'pointer', marginLeft: 'auto', fontWeight: 600 }}
      >
        ⚔ World Map →
      </button>
    </div>
  );
}

// ── WIDGET MODE ───────────────────────────────────────────────────────────────
function GameHUDWidget({ profile, missions, stats, orgId, onNavigate, collapsed, onToggle }) {
  const { level, pct, next } = xpToLevel(profile?.xp || 0);
  const activeMissions = (missions || []).filter(m => m.status === 'active').slice(0, 3);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(200,168,75,0.08)', border: '1px solid rgba(200,168,75,0.2)',
          color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontWeight: 700,
          width: '100%',
        }}
      >
        <span>⚔️</span>
        <span>Sprint Game Status</span>
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>▶</span>
      </button>
    );
  }

  return (
    <div style={{
      padding: 14, background: 'var(--bg2)',
      border: '1px solid rgba(200,168,75,0.2)',
      borderRadius: 10, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 11, letterSpacing: '0.06em' }}>⚔️ SPRINT GAME STATUS</span>
        <button
          onClick={onToggle}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11 }}
        >
          ▼
        </button>
      </div>

      {/* Avatar + XP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <PixelAvatar avatarClass={profile?.avatar_class} size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12, marginBottom: 3 }}>
            {profile?.display_name || 'Dit navn'}{' '}
            <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>Lv.{level}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--gold), #f0c040)', borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{profile?.xp || 0} / {next}</span>
          </div>
        </div>
      </div>

      {/* Sprint Boss HP (project health) */}
      {stats && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
            👾 Sprint Boss HP
            <span style={{ float: 'right', color: 'var(--text2)' }}>{stats.sprint_streak || 0} sprint streak</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, 100 - (stats.at_risk_pct || 0)))}%`,
              background: `linear-gradient(90deg, #38b764, #4bd47a)`,
              borderRadius: 3, transition: 'width 0.8s',
            }} />
          </div>
        </div>
      )}

      {/* Active missions */}
      {activeMissions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            🎯 Aktive missions
          </div>
          {activeMissions.map(m => {
            const mission = m.missions || m;
            const total = mission.trigger_threshold || 1;
            const prog = m.progress || 0;
            const pct = Math.min(100, Math.round((prog / total) * 100));
            return (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text)' }}>{mission.title || mission.name || 'Mission'}</span>
                  <span style={{ color: 'var(--jade)', fontWeight: 700 }}>{prog}/{total}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--jade)', borderRadius: 2, transition: 'width 0.6s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mini leaderboard top-1 */}
      <div style={{ marginBottom: 10 }}>
        <Leaderboard orgId={orgId} mode="widget" category="xp" />
      </div>

      {/* CTA */}
      <button
        onClick={onNavigate}
        style={{
          width: '100%', fontSize: 11, fontWeight: 700, padding: '7px',
          borderRadius: 6, border: '1px solid rgba(200,168,75,0.35)',
          background: 'rgba(200,168,75,0.1)', color: 'var(--gold)', cursor: 'pointer',
        }}
      >
        → Start session
      </button>
    </div>
  );
}

// ── OVERLAY (full game status modal) ─────────────────────────────────────────
function GameHUDOverlay({ orgId, onClose, onNavigate }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, minWidth: 440, maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.02em' }}>⚔️ Game Status</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
        </div>
        <Leaderboard orgId={orgId} mode="full" showCategoryTabs />
        <div style={{ marginTop: 20 }}>
          <button
            onClick={onNavigate}
            style={{ fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--gold)', color: '#0c0c0f', cursor: 'pointer' }}
          >
            ⚔ Gå til World Map
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function GameHUD({ mode = 'bar', sprintId, orgId, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [collapsed, setCollapsed] = useState(mode === 'widget');
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    getCurrentUserProfile().then(setProfile).catch(() => {});
    getUserMissions().then(setMissions).catch(() => {});
    if (mode === 'widget') {
      // getGameStats is heavier — only in widget mode
      import('../lib/api').then(({ getGameStats }) =>
        getGameStats().then(setStats).catch(() => {})
      );
    }
  }, [mode]);

  function handleNavigate() {
    if (onNavigate) onNavigate();
  }

  if (mode === 'bar') {
    return (
      <>
        <GameHUDBar
          profile={profile}
          missions={missions}
          onNavigate={handleNavigate}
          onExpand={() => setShowOverlay(true)}
        />
        {showOverlay && (
          <GameHUDOverlay orgId={orgId} onClose={() => setShowOverlay(false)} onNavigate={handleNavigate} />
        )}
      </>
    );
  }

  return (
    <>
      <GameHUDWidget
        profile={profile}
        missions={missions}
        stats={stats}
        orgId={orgId}
        onNavigate={handleNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      {showOverlay && (
        <GameHUDOverlay orgId={orgId} onClose={() => setShowOverlay(false)} onNavigate={handleNavigate} />
      )}
    </>
  );
}
