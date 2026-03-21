import { PF } from './ssHelpers.js';

export default function FibCard({ value, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className={selected ? 'ss-card-selected' : ''} style={{
      fontFamily: PF, fontSize: 18, minWidth: 64, minHeight: 80,
      background: selected ? 'linear-gradient(135deg, #00aaff22, #00aaff44)' : 'var(--bg2)',
      border: selected ? '3px solid #00aaff' : '2px solid var(--border2)',
      borderBottom: selected ? '3px solid #00aaff' : '4px solid var(--border)',
      borderRight: selected ? '3px solid #00aaff' : '4px solid var(--border)',
      color: selected ? '#00aaff' : 'var(--text)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled && !selected ? 0.5 : 1,
      boxShadow: selected ? '0 0 12px #00aaff44' : 'none',
      transition: 'all 0.15s',
      padding: '12px 8px',
    }}>
      {value}
    </button>
  );
}
