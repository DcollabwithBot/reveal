/**
 * C4: GameModeSelector — Unified game mode selector for session lobby
 *
 * Shows preview cards for all game modes with:
 *  - Pixel art icon
 *  - Name + description
 *  - "Best for:" label
 *  - Difficulty badge
 *  - Select button
 *
 * Props:
 *   selectedMode  {string}   — currently selected mode id
 *   onSelect      {function} — (modeId) => void
 *   compact       {boolean}  — compact grid layout
 */
import { useState } from 'react';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

let gmStylesInjected = false;
function injectGMStyles() {
  if (gmStylesInjected) return;
  gmStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes gm-card-hover {
      0%   { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }
    @keyframes gm-select-pop {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.04); }
      100% { transform: scale(1); }
    }
    @keyframes gm-scanline {
      0%   { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    .gm-card:hover {
      transform: translateY(-4px);
      transition: transform 0.2s ease;
    }
    .gm-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .gm-selected-pop {
      animation: gm-select-pop 0.3s ease;
    }
  `;
  document.head.appendChild(s);
}

// ── Mode definitions ──────────────────────────────────────────────────────────
export const GAME_MODES = [
  {
    id: 'planning_poker',
    name: 'Planning Poker',
    icon: '🃏',
    pixelIcon: '🎴',
    color: '#3b82f6',
    description: 'Classic Fibonacci estimation with boss battles and XP rewards.',
    bestFor: 'Sprint planning, backlog refinement',
    difficulty: 'BEGINNER',
    difficultyColor: 'var(--jade)',
    players: '2–12',
    duration: '30–90 min',
    tag: 'CLASSIC',
    tagColor: 'var(--jade)',
  },
  {
    id: 'spec_wars',
    name: 'Spec Wars',
    icon: '⚔️',
    pixelIcon: '📜',
    color: '#8b5cf6',
    description: 'Write acceptance criteria anonymously. Best spec wins. Improve requirements quality.',
    bestFor: 'Discovery, requirements workshops',
    difficulty: 'INTERMEDIATE',
    difficultyColor: 'var(--warn)',
    players: '3–10',
    duration: '20–45 min',
    tag: 'SPRINT B',
    tagColor: 'var(--warn)',
  },
  {
    id: 'perspective_poker',
    name: 'Perspektiv-Poker',
    icon: '🎭',
    pixelIcon: '👁',
    color: '#f59e0b',
    description: 'Estimate from hidden perspectives (customer, ops, security). Surface blind spots.',
    bestFor: 'Cross-functional teams, complex features',
    difficulty: 'INTERMEDIATE',
    difficultyColor: 'var(--warn)',
    players: '3–8',
    duration: '20–40 min',
    tag: 'SPRINT B',
    tagColor: 'var(--warn)',
  },
  {
    id: 'bluff_poker',
    name: 'Bluff Poker',
    icon: '🕵️',
    pixelIcon: '🎲',
    color: '#ef4444',
    description: 'One team member secretly bluffs. Can the team catch them? Master deception or detection.',
    bestFor: 'Team building, retrospectives',
    difficulty: 'ADVANCED',
    difficultyColor: 'var(--danger)',
    players: '4–10',
    duration: '15–30 min',
    tag: 'NEW',
    tagColor: 'var(--danger)',
  },
  {
    id: 'nesting_scope',
    name: 'Russian Nesting Scope',
    icon: '🪆',
    pixelIcon: '🎎',
    color: '#10b981',
    description: 'Break large items into sub-tasks together. Watch the Matryoshka doll reveal hidden scope.',
    bestFor: 'Large epics, discovery, scope workshops',
    difficulty: 'INTERMEDIATE',
    difficultyColor: 'var(--warn)',
    players: '3–12',
    duration: '30–60 min',
    tag: 'NEW',
    tagColor: '#10b981',
  },
  {
    id: 'speed_scope',
    name: 'Speed Scope',
    icon: '⚡',
    pixelIcon: '⚡',
    color: '#00aaff',
    description: 'Gut-feel estimates in 10 seconds, then discuss. Find hidden complexity by comparing deltas.',
    bestFor: 'Large backlogs, calibration, velocity review',
    difficulty: 'BEGINNER',
    difficultyColor: 'var(--jade)',
    players: '2–15',
    duration: '10–30 min',
    tag: 'NEW',
    tagColor: '#00aaff',
  },
];

// ── Difficulty badge ──────────────────────────────────────────────────────────
function DifficultyBadge({ label, color }) {
  return (
    <span style={{
      fontFamily: PF, fontSize: 5, color, letterSpacing: 1,
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: 3, padding: '3px 6px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Mode card ─────────────────────────────────────────────────────────────────
function ModeCard({ mode, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`gm-card ${selected ? 'gm-selected-pop' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${mode.color}18, ${mode.color}28)`
          : hovered ? 'var(--bg3)' : 'var(--bg2)',
        border: selected
          ? `2px solid ${mode.color}`
          : hovered ? `2px solid ${mode.color}66` : '2px solid var(--border)',
        borderRadius: 10,
        padding: '16px 14px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: selected ? `0 0 16px ${mode.color}33` : 'none',
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      onClick={() => onSelect(mode.id)}
    >
      {/* Scanline overlay for selected */}
      {selected && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Tag badge */}
      {mode.tag && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontFamily: PF, fontSize: 5, color: mode.tagColor,
          background: `${mode.tagColor}18`, border: `1px solid ${mode.tagColor}44`,
          borderRadius: 3, padding: '2px 6px',
        }}>
          {mode.tag}
        </div>
      )}

      {/* Icon */}
      <div style={{ fontSize: 36, lineHeight: 1 }}>{mode.icon}</div>

      {/* Name */}
      <div style={{ fontFamily: PF, fontSize: 7, color: selected ? mode.color : 'var(--text)', letterSpacing: 1, paddingRight: 40 }}>
        {mode.name}
      </div>

      {/* Description */}
      <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)', lineHeight: 1.4, flex: 1 }}>
        {mode.description}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <DifficultyBadge label={mode.difficulty} color={mode.difficultyColor} />
        <span style={{ fontFamily: PF, fontSize: 5, color: 'var(--text3)' }}>👥 {mode.players}</span>
        <span style={{ fontFamily: PF, fontSize: 5, color: 'var(--text3)' }}>⏱ {mode.duration}</span>
      </div>

      {/* Best for */}
      <div style={{ fontFamily: VT, fontSize: 14, color: 'var(--text3)' }}>
        Best for: {mode.bestFor}
      </div>

      {/* Select indicator */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          fontFamily: PF, fontSize: 6, color: mode.color,
          background: `${mode.color}22`, border: `1px solid ${mode.color}`,
          borderRadius: 3, padding: '3px 8px',
        }}>
          ✓ SELECTED
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GameModeSelector({ selectedMode, onSelect, compact = false, availableModes }) {
  const modes = availableModes
    ? GAME_MODES.filter(m => availableModes.includes(m.id))
    : GAME_MODES;

  // Inject styles on first render
  if (typeof document !== 'undefined') injectGMStyles();

  return (
    <div>
      <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>
        SELECT GAME MODE
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: compact
          ? 'repeat(auto-fill, minmax(180px, 1fr))'
          : 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {modes.map(mode => (
          <ModeCard
            key={mode.id}
            mode={mode}
            selected={selectedMode === mode.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Selected mode summary */}
      {selectedMode && (() => {
        const m = GAME_MODES.find(g => g.id === selectedMode);
        if (!m) return null;
        return (
          <div style={{
            marginTop: 16,
            background: `${m.color}10`,
            border: `1px solid ${m.color}44`,
            borderRadius: 8,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>{m.icon}</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 7, color: m.color }}>{m.name}</div>
              <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)' }}>{m.description}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
