import { useEffect, useState } from 'react';
import { useGameMode } from '../shared/GameModeContext';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const ORG_ROLES = [
  { value: 'owner', label: 'Owner', color: 'var(--gold)' },
  { value: 'admin', label: 'Admin', color: 'var(--epic)' },
  { value: 'member', label: 'Member', color: 'var(--jade)' },
  { value: 'observer', label: 'Observer', color: 'var(--text3)' },
];

function RoleTag({ role }) {
  const def = ORG_ROLES.find(r => r.value === role) || { label: role, color: 'var(--text3)' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 10,
      background: 'var(--bg3)', border: `1px solid ${def.color}44`,
      color: def.color, fontWeight: 600,
    }}>
      {def.label}
    </span>
  );
}

function TeamRoles({ myPermissions }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);

  const canManage = myPermissions.includes('manage_members');

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/org/members', { headers });
        if (r.ok) setMembers(await r.json());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  async function handleRoleChange(memberId, newRole) {
    setSaving(memberId);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/org/members/${memberId}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole }),
      });
      if (r.ok) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        setToast('Rolle opdateret');
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await r.json();
        setToast(`Fejl: ${data.error}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch { /* ignore */ }
    setSaving(null);
  }

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--jade)', color: '#0c0c0f',
          borderRadius: 'var(--radius)', padding: '10px 16px',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Henter teammedlemmer...</div>}

      {!loading && members.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Ingen teammedlemmer fundet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {members.map(m => (
          <div
            key={m.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--text2)', flexShrink: 0,
            }}>
              {(m.display_name || '?').slice(0, 2).toUpperCase()}
            </div>

            {/* Name + you badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.display_name}
                {m.is_me && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 6, padding: '1px 5px' }}>dig</span>
                )}
              </div>
            </div>

            {/* Role */}
            {canManage && !m.is_me ? (
              <select
                value={m.role}
                disabled={saving === m.id}
                onChange={e => handleRoleChange(m.id, e.target.value)}
                style={{
                  fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius)',
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  color: 'var(--text)', cursor: 'pointer',
                }}
              >
                {ORG_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            ) : (
              <RoleTag role={m.role} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const MODES = [
  {
    key: 'focus',
    label: 'Focus',
    icon: '🎯',
    tagline: 'Ren PM-flade. Ingen XP eller game-elementer.',
    features: ['Rene task-lister', 'Ingen XP badges', 'Ingen boss battles', 'Nul distrationer'],
  },
  {
    key: 'engaged',
    label: 'Engaged',
    icon: '⚔️',
    tagline: 'Subtile game-signaler. XP, rarity, streak.',
    features: ['XP badges & streak', 'Rarity strips', 'Side quests', 'Game widget'],
  },
  {
    key: 'full',
    label: 'Full',
    icon: '🔥',
    tagline: 'Alt on. Boss battles, particles, level-up.',
    features: ['Alt fra Engaged', 'Boss HP bar', 'Particle effects', 'Level-up overlays'],
  },
];

export default function WorkspaceSettings({ onBack }) {
  const { gameMode, updateGameMode } = useGameMode();
  const [myPermissions, setMyPermissions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/me/permissions', { headers });
        if (r.ok) {
          const data = await r.json();
          setMyPermissions(data.permissions || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(12,12,15,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, padding: '4px 0' }}
          >
            ← Tilbage
          </button>
        )}
        <span style={{ color: 'var(--border2)' }}>|</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>⚙ Workspace Settings</span>
      </div>

      <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>🎮 Game Intensity</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Vælg hvor meget game-UI teamet ser. Gælder for hele workspacet.</div>
        </div>

        {/* Mode cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {MODES.map((m) => {
            const active = gameMode === m.key;
            return (
              <Card
                key={m.key}
                onClick={() => updateGameMode(m.key)}
                style={{
                  padding: '24px 20px',
                  cursor: 'pointer',
                  position: 'relative',
                  borderColor: active ? 'var(--jade)' : undefined,
                  boxShadow: active ? '0 0 20px var(--jade-mid)' : undefined,
                  background: active ? 'var(--jade-dim)' : undefined,
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 11, fontWeight: 600, color: 'var(--jade)',
                    background: 'var(--jade-dim)', border: '1px solid rgba(0,200,150,0.28)',
                    borderRadius: 20, padding: '2px 8px'
                  }}>
                    ✓ Aktiv
                  </div>
                )}
                <div style={{ fontSize: 28, marginBottom: 12 }}>{m.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>{m.tagline}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {m.features.map((f) => (
                    <li key={f} style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--jade)', fontSize: 10 }}>·</span> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* Team & Roller section */}
        <div style={{ marginTop: 48 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>👥 Team & Roller</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              Administrér teammedlemmer og deres roller i organisationen.
              {!myPermissions.includes('manage_members') && (
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text3)' }}>(Du har ikke adgang til at ændre roller)</span>
              )}
            </div>
          </div>
          <TeamRoles myPermissions={myPermissions} />
        </div>
      </div>
    </div>
  );
}
