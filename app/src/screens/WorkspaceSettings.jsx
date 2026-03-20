import { useGameMode } from '../shared/GameModeContext';
import { Card } from '../components/ui/Card';

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
      </div>
    </div>
  );
}
