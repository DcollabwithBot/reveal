/**
 * SoundToggle — 🔊/🔇 toggle knap til alle game screens
 *
 * Props:
 *   soundEnabled {boolean}
 *   onToggle     {function}
 *   size         {'sm'|'md'} (default: 'md')
 */
import { useState } from 'react';

const PF = "'Press Start 2P', monospace";

let stStylesInjected = false;
function injectSTStyles() {
  if (stStylesInjected) return;
  stStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes st-pop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.25); }
      70%  { transform: scale(0.93); }
      100% { transform: scale(1); }
    }
    @keyframes st-mute-flash {
      0%   { opacity: 1; }
      50%  { opacity: 0.4; }
      100% { opacity: 1; }
    }
    .st-popping { animation: st-pop 0.25s ease; }
    .st-muting  { animation: st-mute-flash 0.3s ease; }
  `;
  document.head.appendChild(s);
}

export default function SoundToggle({ soundEnabled, onToggle, size = 'md' }) {
  const [anim, setAnim] = useState(null);

  if (typeof document !== 'undefined') injectSTStyles();

  function handleClick() {
    setAnim(soundEnabled ? 'muting' : 'popping');
    setTimeout(() => setAnim(null), 300);
    onToggle();
  }

  const isSmall = size === 'sm';
  const px = isSmall ? 6 : 8;
  const fs = isSmall ? 12 : 16;

  return (
    <button
      onClick={handleClick}
      className={anim === 'popping' ? 'st-popping' : anim === 'muting' ? 'st-muting' : ''}
      title={soundEnabled ? 'Slå lyd fra' : 'Slå lyd til'}
      style={{
        fontFamily: PF,
        fontSize: fs,
        background: soundEnabled ? 'var(--bg3)' : 'rgba(232,84,84,0.12)',
        border: soundEnabled
          ? '1px solid var(--border2)'
          : '1px solid rgba(232,84,84,0.35)',
        borderRadius: 4,
        padding: `${px - 2}px ${px + 2}px`,
        cursor: 'pointer',
        color: soundEnabled ? 'var(--text2)' : 'var(--danger)',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: isSmall ? 14 : 18 }}>
        {soundEnabled ? '🔊' : '🔇'}
      </span>
      {!isSmall && (
        <span style={{ fontSize: 6, letterSpacing: 1, opacity: 0.7 }}>
          {soundEnabled ? 'SFX' : 'MUTED'}
        </span>
      )}
    </button>
  );
}
