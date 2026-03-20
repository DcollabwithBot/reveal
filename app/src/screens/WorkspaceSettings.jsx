import { useGameMode } from '../shared/GameModeContext';

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
    <div style={S.container}>
      <div style={S.scanlines} />
      <div style={S.panel}>
        <div style={S.topbar}>
          {onBack && (
            <button style={S.ghostBtn} onClick={onBack}>← Tilbage</button>
          )}
          <div style={S.title}>⚙ Workspace Settings</div>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>🎮 Game Intensity</div>
          <div style={S.sectionSub}>Vælg hvor meget game-UI teamet ser. Gælder for hele workspacet.</div>

          <div style={S.cards}>
            {MODES.map((m) => {
              const active = gameMode === m.key;
              return (
                <button
                  key={m.key}
                  style={{ ...S.card, ...(active ? S.cardActive : {}) }}
                  onClick={() => updateGameMode(m.key)}
                >
                  <div style={S.cardIcon}>{m.icon}</div>
                  <div style={S.cardLabel}>{m.label}</div>
                  {active && <div style={S.activeBadge}>✓ Aktiv</div>}
                  <div style={S.cardTagline}>{m.tagline}</div>
                  <ul style={S.featureList}>
                    {m.features.map((f) => (
                      <li key={f} style={S.featureItem}>· {f}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const JADE = '#10b981';
const S = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0e1019',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    position: 'relative',
    overflow: 'auto',
    padding: '24px 0',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  panel: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '900px',
    padding: '28px',
    background: 'rgba(14, 16, 25, 0.95)',
    border: '2px solid #7c3aed',
    boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3)',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '10px',
    color: '#d1d5db',
  },
  ghostBtn: {
    padding: '10px 12px',
    background: 'transparent',
    border: '1px solid #4b5563',
    color: '#d1d5db',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '9px',
    color: '#a78bfa',
    marginBottom: '6px',
  },
  sectionSub: {
    fontSize: '6px',
    color: '#6b7280',
    marginBottom: '20px',
    lineHeight: 1.8,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  card: {
    background: 'rgba(26, 28, 46, 0.8)',
    border: '2px solid #374151',
    padding: '20px 16px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'Press Start 2P', monospace",
    color: '#d1d5db',
    transition: 'border-color 0.2s',
    position: 'relative',
  },
  cardActive: {
    border: `2px solid ${JADE}`,
    boxShadow: `0 0 16px ${JADE}44`,
    background: `rgba(16, 185, 129, 0.05)`,
  },
  cardIcon: {
    fontSize: '24px',
    marginBottom: '10px',
  },
  cardLabel: {
    fontSize: '9px',
    color: '#f9fafb',
    marginBottom: '8px',
  },
  activeBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    fontSize: '5px',
    color: JADE,
    border: `1px solid ${JADE}`,
    padding: '3px 6px',
  },
  cardTagline: {
    fontSize: '6px',
    color: '#9ca3af',
    marginBottom: '12px',
    lineHeight: 1.8,
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  featureItem: {
    fontSize: '5px',
    color: '#6b7280',
    marginBottom: '4px',
    lineHeight: 1.6,
  },
};
