/**
 * GameTimer — Shared countdown timer component for all game modes
 *
 * Props:
 *   seconds    {number}   — total seconds to count down
 *   onExpire   {function} — called when timer hits 0
 *   size       {'sm'|'md'|'lg'|'xl'} — display size
 *   label      {string}   — optional label above timer
 *   playTicks  {boolean}  — play tick sounds? (default true)
 *   urgent     {number}   — threshold in seconds to turn red (default 5)
 *   warn       {number}   — threshold in seconds to turn yellow (default 10)
 *   autoStart  {boolean}  — start immediately (default true)
 *   paused     {boolean}  — pause the timer
 *   key        {*}        — change key to reset
 */
import { useState, useEffect, useRef } from 'react';

const PF = "'Press Start 2P', monospace";

let gtStylesInjected = false;
function injectGTStyles() {
  if (gtStylesInjected) return;
  gtStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes gt-pulse-urgent {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.75; transform: scale(1.04); }
    }
    @keyframes gt-pulse-warn {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.8; }
    }
    @keyframes gt-buzz {
      0%,100% { transform: translate(0); }
      15%     { transform: translate(-5px, 3px); }
      30%     { transform: translate(5px, -3px); }
      45%     { transform: translate(-4px, 4px); }
      60%     { transform: translate(4px, -2px); }
      75%     { transform: translate(-2px, 1px); }
    }
    @keyframes gt-flash {
      0%   { background: rgba(232,84,84,0.5); }
      100% { background: transparent; }
    }
    .gt-urgent { animation: gt-pulse-urgent 0.5s ease-in-out infinite; }
    .gt-warn    { animation: gt-pulse-warn   1s ease-in-out infinite; }
    .gt-buzz    { animation: gt-buzz 0.5s ease; }
    .gt-flash   { animation: gt-flash 0.6s ease forwards; }
  `;
  document.head.appendChild(s);
}

function playTick(freq = 880, duration = 0.05, gain = 0.05) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), 300);
  } catch {}
}

function playBuzz() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const low = ctx.createOscillator();
    const gl = ctx.createGain();
    low.connect(gl); gl.connect(ctx.destination);
    low.type = 'sawtooth'; low.frequency.value = 55;
    gl.gain.setValueAtTime(0.25, ctx.currentTime);
    gl.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    low.start(); low.stop(ctx.currentTime + 0.4);

    const hi = ctx.createOscillator();
    const gh = ctx.createGain();
    hi.connect(gh); gh.connect(ctx.destination);
    hi.type = 'square'; hi.frequency.value = 880;
    gh.gain.setValueAtTime(0.15, ctx.currentTime);
    gh.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    hi.start(); hi.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

const SIZES = {
  sm: { font: 18, sub: 7, padding: '4px 12px' },
  md: { font: 32, sub: 8, padding: '6px 16px' },
  lg: { font: 56, sub: 9, padding: '8px 20px' },
  xl: { font: 80, sub: 10, padding: '10px 24px' },
};

export default function GameTimer({
  seconds,
  onExpire,
  size = 'lg',
  label,
  playTicks = true,
  urgent = 5,
  warn = 10,
  paused = false,
}) {
  const [left, setLeft] = useState(seconds);
  const [buzzing, setBuzzing] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    injectGTStyles();
  }, []);

  // Reset when seconds prop changes
  useEffect(() => {
    expiredRef.current = false;
    setLeft(seconds);
    setBuzzing(false);
    setFlashing(false);
  }, [seconds]);

  useEffect(() => {
    if (paused || left <= 0) return;
    const t = setTimeout(() => {
      const next = left - 1;
      setLeft(next);

      if (playTicks) {
        if (next <= urgent) playTick(1320, 0.04, 0.08);
        else if (next <= warn) playTick(880, 0.05, 0.05);
      }

      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setBuzzing(true);
        setFlashing(true);
        playBuzz();
        setTimeout(() => setBuzzing(false), 500);
        setTimeout(() => setFlashing(false), 600);
        onExpire?.();
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [left, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const isUrgent = left <= urgent && left > 0;
  const isWarn = left <= warn && left > urgent;
  const sz = SIZES[size] || SIZES.lg;
  const color = isUrgent ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--jade)';

  const m = Math.floor(left / 60);
  const s = left % 60;
  const display = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(Math.max(0, s));

  return (
    <div style={{ position: 'relative', textAlign: 'center', display: 'inline-block' }}>
      {flashing && (
        <div
          className="gt-flash"
          style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}
        />
      )}
      {label && (
        <div style={{ fontFamily: PF, fontSize: sz.sub, color: 'var(--text3)', letterSpacing: 2, marginBottom: 4 }}>
          {label}
        </div>
      )}
      <div
        className={buzzing ? 'gt-buzz' : isUrgent ? 'gt-urgent' : isWarn ? 'gt-warn' : ''}
        style={{
          fontFamily: PF,
          fontSize: sz.font,
          color,
          lineHeight: 1,
          textShadow: `0 0 ${isUrgent ? 20 : 10}px ${color}88`,
          padding: sz.padding,
          transition: 'color 0.3s, text-shadow 0.3s',
        }}
      >
        {display}
      </div>
    </div>
  );
}
