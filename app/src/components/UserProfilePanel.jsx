import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const LEVELS = [
  { min: 0, label: 'Novice', color: '#9ca3af' },
  { min: 100, label: 'Apprentice', color: '#60a5fa' },
  { min: 300, label: 'Practitioner', color: '#a78bfa' },
  { min: 700, label: 'Expert', color: '#f59e0b' },
  { min: 1500, label: 'Master', color: '#ef4444' },
];

const BADGES = {
  estimation_sniper: { icon: '🎯', label: 'Estimation Sniper', desc: '5 sessions med >85% accuracy' },
  risk_hunter: { icon: '🔍', label: 'Risk Hunter', desc: '3 Risk Cards viste sig reelle' },
  scope_master: { icon: '📋', label: 'Scope Master', desc: '5 sessioner med høj confidence' },
  truth_teller: { icon: '💬', label: 'Truth Teller', desc: 'Truth Serum i 3 sessioner' },
  team_anchor: { icon: '⚓', label: 'Team Anchor', desc: 'Deltaget i >20 sessioner' },
  sprint_streak: { icon: '🔥', label: 'Sprint Streak', desc: '3 sprints til tiden i træk' },
  perfect_fill: { icon: '🎯', label: 'Perfect Fill', desc: 'Sprint Draft 100% kapacitet' },
};

function getLevelInfo(xp) {
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
  return { ...current, progress: Math.min(100, progress), xp, nextLevel };
}

export function UserProfileMini({ user }) {
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles')
      .select('display_name, avatar_class, xp, level, accuracy_score')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user?.id]);

  if (!profile) return null;

  const levelInfo = getLevelInfo(profile.xp || 0);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '4px 10px',
          cursor: 'pointer', fontSize: 11, color: 'var(--text)',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: levelInfo.color, display: 'grid', placeItems: 'center',
          fontSize: 8, color: '#fff', fontWeight: 700,
        }}>
          {(profile.level || 1)}
        </span>
        <span>{profile.display_name || 'Player'}</span>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>
          {profile.xp || 0} XP
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 16, minWidth: 260,
          zIndex: 100, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <UserProfilePanel userId={user.id} profile={profile} />
        </div>
      )}
    </div>
  );
}

export default function UserProfilePanel({ userId, profile: initialProfile }) {
  const [profile, setProfile] = useState(initialProfile || null);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    if (!userId) return;
    if (!initialProfile) {
      supabase.from('profiles')
        .select('display_name, avatar_class, xp, level, accuracy_score')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => { if (data) setProfile(data); });
    }
    supabase.from('user_badges')
      .select('badge_type, earned_at')
      .eq('user_id', userId)
      .then(({ data }) => { if (data) setBadges(data); });
  }, [userId, initialProfile]);

  if (!profile) return null;

  const levelInfo = getLevelInfo(profile.xp || 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `linear-gradient(135deg, ${levelInfo.color}, ${levelInfo.color}88)`,
          display: 'grid', placeItems: 'center',
          fontSize: 16, color: '#fff', fontWeight: 700,
          border: `2px solid ${levelInfo.color}`,
        }}>
          {profile.level || 1}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{profile.display_name || 'Player'}</div>
          <div style={{ fontSize: 11, color: levelInfo.color }}>{levelInfo.label}</div>
        </div>
      </div>

      {/* XP Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
          <span>{profile.xp || 0} XP</span>
          <span>{levelInfo.nextLevel ? `${levelInfo.nextLevel.min} XP for ${levelInfo.nextLevel.label}` : 'MAX LEVEL'}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${levelInfo.progress}%`,
            background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}88)`,
            transition: 'width 0.5s',
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatBox label="Accuracy" value={profile.accuracy_score ? `${profile.accuracy_score}%` : '—'} />
        <StatBox label="Level" value={profile.level || 1} />
      </div>

      {/* Badges */}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>
        Badges
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {Object.entries(BADGES).map(([type, badge]) => {
          const earned = badges.some(b => b.badge_type === type);
          return (
            <div
              key={type}
              title={`${badge.label}: ${badge.desc}`}
              style={{
                textAlign: 'center', padding: 6,
                background: earned ? `${badge.icon === '🔥' ? '#ef4444' : 'var(--jade)'}11` : 'var(--bg3)',
                border: `1px solid ${earned ? 'var(--jade)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                opacity: earned ? 1 : 0.3,
              }}
            >
              <div style={{ fontSize: 18 }}>{badge.icon}</div>
              <div style={{ fontSize: 8, color: earned ? 'var(--text)' : 'var(--text3)', marginTop: 2 }}>
                {badge.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export { LEVELS, BADGES, getLevelInfo };
