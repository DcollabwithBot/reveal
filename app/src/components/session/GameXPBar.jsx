/**
 * GameXPBar — Shared game identity header for ALL game modes
 *
 * Shows:
 *  - Level badge (colored circle + number)
 *  - XP total + progress bar to next level
 *  - +XP gain animation (call showXPGain(amount) ref)
 *
 * Usage:
 *   const xpBarRef = useRef();
 *   <GameXPBar userId={user?.id} ref={xpBarRef} />
 *   // Later: xpBarRef.current?.showXPGain(45)
 */
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '../../lib/supabase';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

export const LEVELS = [
  { min: 0,    label: 'Novice',        color: '#9ca3af', num: 1 },
  { min: 100,  label: 'Apprentice',    color: '#60a5fa', num: 2 },
  { min: 300,  label: 'Practitioner',  color: '#a78bfa', num: 3 },
  { min: 700,  label: 'Expert',        color: '#f59e0b', num: 4 },
  { min: 1500, label: 'Master',        color: '#ef4444', num: 5 },
];

export function getLevelInfo(xp) {
  let current = LEVELS[0];
  let nextLevel = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      current = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = nextLevel
    ? ((xp - current.min) / (nextLevel.min - current.min)) * 100
    : 100;
  return { ...current, progress: Math.min(100, Math.max(0, progress)), xp, nextLevel };
}

// ── CSS injection ──────────────────────────────────────────────────────────────
let gxbStylesInjected = false;
function injectGXBStyles() {
  if (gxbStylesInjected) return;
  gxbStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

    @keyframes gxb-xpBarGrow {
      from { width: 0; }
    }
    @keyframes gxb-xpGainFloat {
      0%   { opacity: 0; transform: translateY(0) scale(0.8); }
      20%  { opacity: 1; transform: translateY(-4px) scale(1.15); }
      80%  { opacity: 1; transform: translateY(-20px) scale(1); }
      100% { opacity: 0; transform: translateY(-36px) scale(0.8); }
    }
    @keyframes gxb-levelUp {
      0%   { transform: scale(1); box-shadow: none; }
      40%  { transform: scale(1.4); box-shadow: 0 0 20px currentColor; }
      70%  { transform: scale(0.95); }
      100% { transform: scale(1); box-shadow: 0 0 6px currentColor; }
    }
    @keyframes gxb-barPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.6; }
    }
    .gxb-bar-fill {
      animation: gxb-xpBarGrow 1s ease forwards;
    }
    .gxb-level-up {
      animation: gxb-levelUp 0.6s ease;
    }
    .gxb-xp-gain {
      animation: gxb-xpGainFloat 1.4s ease forwards;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: 8px;
      font-family: ${PF};
      font-size: 9px;
      color: var(--gold);
      text-shadow: 0 0 8px var(--gold);
      white-space: nowrap;
      z-index: 20;
    }
  `;
  document.head.appendChild(s);
}

// ── Level Badge ───────────────────────────────────────────────────────────────
export function LevelBadge({ level, color, size = 20, levelUpAnim }) {
  return (
    <div
      className={levelUpAnim ? 'gxb-level-up' : ''}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color || '#9ca3af',
        display: 'grid', placeItems: 'center',
        fontSize: size * 0.38, fontFamily: PF, color: '#fff',
        fontWeight: 700,
        boxShadow: `0 0 6px ${color || '#9ca3af'}88`,
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.15)',
      }}
    >
      {level}
    </div>
  );
}

// ── Main GameXPBar ─────────────────────────────────────────────────────────────
const GameXPBar = forwardRef(function GameXPBar({ userId, compact = false }, ref) {
  const [profile, setProfile] = useState(null);
  const [xpGains, setXpGains] = useState([]);   // [{ id, amount }]
  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const gainIdRef = { current: 0 };

  useEffect(() => {
    injectGXBStyles();
    if (!userId) return;
    loadProfile();

    // Subscribe to XP changes
    const sub = supabase
      .channel('gxb-profile-' + userId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        const newXp = payload.new?.xp;
        const oldXp = profile?.xp || 0;
        if (newXp != null && newXp > oldXp) {
          const gain = newXp - oldXp;
          triggerXPGain(gain);
        }
        setProfile(prev => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, xp, level')
      .eq('id', userId)
      .maybeSingle();
    if (data) setProfile(data);
  }

  function triggerXPGain(amount) {
    const id = ++gainIdRef.current;
    setXpGains(prev => [...prev, { id, amount }]);
    setTimeout(() => setXpGains(prev => prev.filter(g => g.id !== id)), 1500);
  }

  // Expose showXPGain to parent via ref
  useImperativeHandle(ref, () => ({
    showXPGain(amount) { triggerXPGain(amount); },
    refresh() { loadProfile(); },
  }));

  if (!profile) return null;

  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const levelInfo = getLevelInfo(xp);
  const barWidth = `${levelInfo.progress}%`;

  if (compact) {
    // Compact: just badge + xp number (for use inside avatar header)
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
        <LevelBadge level={level} color={levelInfo.color} size={18} levelUpAnim={levelUpAnim} />
        <span style={{ fontFamily: PF, fontSize: 6, color: 'var(--gold)' }}>{xp} XP</span>
        {xpGains.map(g => (
          <span key={g.id} className="gxb-xp-gain">+{g.amount} XP</span>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6,
      padding: '6px 12px',
      position: 'relative',
      minWidth: 160,
    }}>
      {/* Level badge */}
      <LevelBadge level={level} color={levelInfo.color} size={24} levelUpAnim={levelUpAnim} />

      {/* XP info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
          <span style={{ fontFamily: PF, fontSize: 6, color: levelInfo.color, letterSpacing: 1 }}>
            {levelInfo.label}
          </span>
          <span style={{ fontFamily: PF, fontSize: 6, color: 'var(--gold)' }}>
            {xp} XP
          </span>
        </div>
        {/* XP progress bar */}
        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            className="gxb-bar-fill"
            style={{
              height: '100%',
              width: barWidth,
              background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}cc)`,
              borderRadius: 3,
              boxShadow: `0 0 6px ${levelInfo.color}66`,
            }}
          />
        </div>
        {levelInfo.nextLevel && (
          <div style={{ fontFamily: PF, fontSize: 4, color: 'var(--text3)', marginTop: 2 }}>
            {levelInfo.nextLevel.min - xp} XP to {levelInfo.nextLevel.label}
          </div>
        )}
      </div>

      {/* Floating XP gain */}
      {xpGains.map(g => (
        <span key={g.id} className="gxb-xp-gain">+{g.amount} XP</span>
      ))}
    </div>
  );
});

export default GameXPBar;
