/**
 * SessionTypePresets — v3.1 Room Type presets as session configuration shortcuts.
 * Implements Fase 2 "light" room specialization via preset selection.
 *
 * 4 presets:
 * - Estimation Room → Planning Poker + Speed Scope
 * - Scope Room → Spec Wars + Russian Nesting
 * - Breakdown Room → Russian Nesting + Perspektiv-Poker
 * - Retro Room → Boss Battle Retro + Truth Serum
 */
import { useState } from 'react';

const PF = "'Press Start 2P', monospace";

export const SESSION_PRESETS = [
  {
    id: 'estimation_room',
    icon: '🃏',
    name: 'Estimation Room',
    tagline: 'Hurtig og præcis estimering',
    color: '#a855f7',
    colorDim: 'rgba(168,85,247,0.12)',
    modes: ['planning_poker', 'speed_scope'],
    modeLabels: ['Planning Poker', 'Speed Scope'],
    bestFor: 'Sprint planning, backlog refinement',
    description: 'Kombination af silent vote og tidsbaseret estimering. Eliminerer anchoring bias.',
    tip: '💡 Brug Speed Scope til at accelerere lange backlogs',
  },
  {
    id: 'scope_room',
    icon: '🎯',
    name: 'Scope Room',
    tagline: 'Definer og udfordr scope',
    color: '#f59e0b',
    colorDim: 'rgba(245,158,11,0.12)',
    modes: ['spec_wars', 'nesting_scope'],
    modeLabels: ['Spec Wars', 'Russian Nesting'],
    bestFor: 'Feature definition, user stories',
    description: 'Skriv acceptance criteria under tidspres og dekomponer komplekse features.',
    tip: '💡 Spec Wars afslører scope-ambiguity hurtigt',
  },
  {
    id: 'breakdown_room',
    icon: '🔬',
    name: 'Breakdown Room',
    tagline: 'Perspektiv og nedbrydning',
    color: '#06b6d4',
    colorDim: 'rgba(6,182,212,0.12)',
    modes: ['nesting_scope', 'perspective_poker'],
    modeLabels: ['Russian Nesting', 'Perspektiv-Poker'],
    bestFor: 'Komplekse features, teknisk debt',
    description: 'Del store opgaver op og estimér fra flere perspektiver (tech, design, PM).',
    tip: '💡 Perspektiv-Poker avdækker skjulte antagelser',
  },
  {
    id: 'retro_room',
    icon: '⚔️',
    name: 'Retro Room',
    tagline: 'Lær af fortiden',
    color: '#ef4444',
    colorDim: 'rgba(239,68,68,0.12)',
    modes: ['boss_battle', 'truth_serum'],
    modeLabels: ['Boss Battle Retro', 'Truth Serum'],
    bestFor: 'Sprint retrospektiver, bias check',
    description: 'Gamified retrospektiv kombineret med hemmeligt bias-estimering.',
    tip: '💡 Truth Serum efter Boss Battle giver dyb indsigt',
  },
];

export default function SessionTypePresets({ selectedPreset, onSelect, compact = false }) {
  const [hover, setHover] = useState(null);

  if (compact) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>
          Session Type
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SESSION_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => onSelect(selectedPreset === preset.id ? null : preset.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600,
                background: selectedPreset === preset.id ? preset.colorDim : 'var(--bg3)',
                border: `1px solid ${selectedPreset === preset.id ? preset.color + '66' : 'var(--border)'}`,
                color: selectedPreset === preset.id ? preset.color : 'var(--text2)',
                transition: 'all 0.15s',
              }}
            >
              <span>{preset.icon}</span>
              <span>{preset.name}</span>
              {selectedPreset === preset.id && <span style={{ fontSize: 9 }}>✓</span>}
            </button>
          ))}
        </div>
        {selectedPreset && (() => {
          const p = SESSION_PRESETS.find(pr => pr.id === selectedPreset);
          if (!p) return null;
          return (
            <div style={{
              marginTop: 8, padding: '8px 12px',
              background: p.colorDim, border: `1px solid ${p.color}33`,
              borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text2)',
            }}>
              <span style={{ color: p.color, fontWeight: 600, marginRight: 6 }}>{p.modeLabels.join(' + ')}</span>
              · {p.description}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontFamily: PF, fontSize: 7, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '2px',
        marginBottom: 16, textAlign: 'center',
      }}>
        ◈ VÆLG SESSION TYPE ◈
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {SESSION_PRESETS.map(preset => {
          const isSelected = selectedPreset === preset.id;
          const isHovered = hover === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => onSelect(isSelected ? null : preset.id)}
              onMouseEnter={() => setHover(preset.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                padding: '16px 18px', cursor: 'pointer',
                background: isSelected ? preset.colorDim : isHovered ? 'rgba(255,255,255,0.03)' : 'var(--bg2)',
                border: `2px solid ${isSelected ? preset.color : isHovered ? preset.color + '44' : 'var(--border)'}`,
                borderTop: `3px solid ${preset.color}`,
                transition: 'all 0.15s',
                transform: isHovered ? 'translateY(-2px)' : 'none',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 0,
                  background: `${preset.color}22`, border: `2px solid ${preset.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {preset.icon}
                </div>
                <div>
                  <div style={{ fontFamily: PF, fontSize: 7, color: preset.color, lineHeight: 1.6 }}>
                    {preset.name.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {preset.tagline}
                  </div>
                </div>
              </div>

              {/* Modes */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {preset.modeLabels.map((label, idx) => (
                  <span key={idx} style={{
                    fontSize: 9, padding: '2px 7px',
                    background: `${preset.color}1a`, border: `1px solid ${preset.color}33`,
                    color: preset.color, borderRadius: 3,
                  }}>
                    {label}
                  </span>
                ))}
              </div>

              {/* Description */}
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>
                {preset.description}
              </div>

              {/* Best for */}
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                <span style={{ color: preset.color, fontWeight: 600 }}>Bedst til: </span>
                {preset.bestFor}
              </div>

              {/* Tip (shown on hover/select) */}
              {(isSelected || isHovered) && (
                <div style={{
                  marginTop: 10, padding: '6px 10px',
                  background: `${preset.color}11`, border: `1px solid ${preset.color}33`,
                  fontSize: 10, color: 'var(--text2)', lineHeight: 1.5,
                }}>
                  {preset.tip}
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <span style={{ fontFamily: PF, fontSize: 7, color: preset.color }}>
                    ✓ VALGT
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
