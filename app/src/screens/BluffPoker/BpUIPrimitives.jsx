import { dk } from '../../shared/utils.js';
import { PF, VT } from './bpHelpers.js';

export function PixelBtn({ onClick, disabled, children, color = 'var(--epic)', style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: PF, fontSize: '10px', padding: '10px 20px',
      background: color, color: '#fff', border: 'none', cursor: disabled ? 'default' : 'pointer',
      borderBottom: `4px solid ${dk(color.replace('var(--','').replace(')',''), 40)}`,
      borderRight: `4px solid ${dk(color.replace('var(--','').replace(')',''), 40)}`,
      opacity: disabled ? 0.5 : 1, imageRendering: 'pixelated',
      transition: 'transform 0.05s', ...style,
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translate(2px,2px)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = ''; }}
    >{children}</button>
  );
}

export function AchievementPopup({ name, icon, desc, xp, onClose }) {
  return (
    <div className="bp-pop-in" style={{
      position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999,
      background: 'var(--bg2)', border: '3px solid var(--epic)',
      boxShadow: '0 0 24px var(--epic)', padding: '16px 20px',
      minWidth: '260px', fontFamily: VT,
      animation: 'bp-glow 2s ease-in-out infinite',
    }}>
      <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--epic)', marginBottom: '6px' }}>
        ACHIEVEMENT UNLOCKED
      </div>
      <div style={{ fontSize: '28px', marginBottom: '4px' }}>{icon || '🏆'} <span style={{ fontSize: '20px' }}>{name || 'UNLOCKED'}</span></div>
      <div style={{ fontSize: '18px', color: 'var(--text2)', marginBottom: '8px' }}>{desc}</div>
      <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--gold)' }}>+{xp} XP</div>
      <button onClick={onClose} style={{
        position: 'absolute', top: '8px', right: '8px',
        background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: VT, fontSize: '20px',
      }}>✕</button>
    </div>
  );
}

function ConfettiPiece({ color, x, delay }) {
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: '-10px',
      width: '8px', height: '8px', background: color,
      animation: `bp-confetti-fall ${1 + Math.random()}s ease-in ${delay}s forwards`,
      zIndex: 50,
    }} />
  );
}

export function Confetti() {
  const colors = ['var(--gold)','var(--epic)','var(--jade)','var(--warn)','var(--danger)'];
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    color: colors[i % colors.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </div>
  );
}
