import { useState, useEffect } from 'react';
import { playDing } from './nsAudio.js';
import { PF, VT } from './nsHelpers.js';

export default function AchievementPopup({ achievements, onDone }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!achievements.length) { onDone(); return; }
    playDing(idx + 4);
  }, [idx]);

  const next = () => {
    if (idx + 1 < achievements.length) setIdx(i => i + 1);
    else onDone();
  };

  if (!achievements.length) return null;
  const ach = achievements[idx];

  return (
    <div className="ns-achievement-popup" onClick={next} style={{ cursor: 'pointer' }}>
      <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--gold)', marginBottom: 8 }}>ACHIEVEMENT UNLOCKED</div>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{ach.icon || '🏆'}</div>
      <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--text)', marginBottom: 4 }}>{ach.name}</div>
      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{ach.desc}</div>
      <div style={{ fontFamily: VT, fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>TAP TO CONTINUE</div>
    </div>
  );
}
