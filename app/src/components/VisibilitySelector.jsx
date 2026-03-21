import { useState } from 'react';

const VISIBILITY_OPTIONS = [
  { value: 'public',     icon: '🌐', label: 'Åben',      desc: 'Vises i missions og leaderboard' },
  { value: 'restricted', icon: '👥', label: 'Begrænset', desc: 'Kun for teammedlemmer' },
  { value: 'private',    icon: '🔒', label: 'Privat',    desc: 'Skjult fra alle game surfaces' },
];

export default function VisibilitySelector({ value = 'public', onChange, disabled = false, compact = false }) {
  const current = VISIBILITY_OPTIONS.find(o => o.value === value) || VISIBILITY_OPTIONS[0];

  if (compact) {
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.value)}
        style={{
          fontSize: 11,
          padding: '3px 6px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg2)',
          color: 'var(--text2)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {VISIBILITY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        🔒 Projektsynlighed
      </div>
      {VISIBILITY_OPTIONS.map(o => {
        const active = value === o.value;
        return (
          <label
            key={o.value}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${active ? 'rgba(0,200,150,0.35)' : 'var(--border)'}`,
              background: active ? 'var(--jade-dim)' : 'var(--bg2)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <input
              type="radio"
              name="visibility"
              value={o.value}
              checked={active}
              disabled={disabled}
              onChange={() => onChange?.(o.value)}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--jade)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{o.icon}</span>
                <span>{o.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.desc}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export function VisibilityBadge({ value = 'public' }) {
  const opt = VISIBILITY_OPTIONS.find(o => o.value === value) || VISIBILITY_OPTIONS[0];
  if (value === 'public') return null; // Don't show badge for public — it's the default
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 7px',
      borderRadius: 10,
      background: value === 'private' ? 'rgba(232,84,84,0.12)' : 'rgba(200,168,75,0.1)',
      border: `1px solid ${value === 'private' ? 'rgba(232,84,84,0.3)' : 'rgba(200,168,75,0.3)'}`,
      color: value === 'private' ? 'var(--danger)' : 'var(--gold)',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
    }}>
      {opt.icon} {opt.label}
    </span>
  );
}
