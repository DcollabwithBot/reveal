import { useState, useEffect, useRef } from 'react';
import { playBuzzer, playFastTick, playTick } from './ssAudio.js';
import { PF } from './ssHelpers.js';

export default function CountdownTimer({ seconds, onExpire, urgent = false }) {
  const [left, setLeft] = useState(seconds);
  const [buzzed, setBuzzed] = useState(false);
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;
    setBuzzed(false);
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (left <= 0) {
      if (!expired.current) {
        expired.current = true;
        setBuzzed(true);
        playBuzzer();
        setTimeout(() => { setBuzzed(false); onExpire?.(); }, 600);
      }
      return;
    }
    const t = setTimeout(() => {
      setLeft(l => l - 1);
      if (left <= 3) playFastTick();
      else if (left <= 6) playTick();
    }, 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const isUrgent = left <= 3;
  const isWarn = left <= 5 && left > 3;
  const m = Math.floor(left / 60);
  const s = left % 60;
  const color = isUrgent ? 'var(--danger)' : isWarn ? 'var(--warn)' : '#00aaff';

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      {buzzed && <div className="ss-buzzer-flash" style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }} />}
      <div className={isUrgent ? 'ss-timer-urgent' : ''} style={{ fontFamily: PF, fontSize: 72, color, lineHeight: 1, textShadow: `0 0 20px ${color}88`, letterSpacing: 4 }}>
        {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : s}
      </div>
      {isUrgent && <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)', letterSpacing: 2, marginTop: 4 }}>HURRY UP!</div>}
    </div>
  );
}
