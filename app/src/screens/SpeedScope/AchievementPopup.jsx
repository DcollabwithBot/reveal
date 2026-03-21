import { useEffect } from 'react';
import { PF, VT } from './ssHelpers.js';

export default function AchievementPopup({ name, icon, desc, xp, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' }}>
      <div className="ss-pop" style={{ background: 'var(--bg2)', border: '2px solid var(--epic)', borderRadius: 14, padding: '28px 36px', textAlign: 'center', maxWidth: 320, pointerEvents: 'auto', boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{icon || '🏆'}</div>
        <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ACHIEVEMENT UNLOCKED</div>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--epic)', marginBottom: 6 }}>{name}</div>
        <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginBottom: 12 }}>{desc}</div>
        <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', background: 'rgba(184,147,46,0.1)', border: '1px solid rgba(184,147,46,0.3)', borderRadius: 4, padding: '6px 12px', display: 'inline-block', marginBottom: 12 }}>+{xp} XP</div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', fontFamily: PF, fontSize: 7, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}>NICE</button>
      </div>
    </div>
  );
}
