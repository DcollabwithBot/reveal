import { handleSoftError } from '../../lib/errorHandler';
import { isSoundEnabled } from '../../hooks/useGameSound.js';

export function playCoin() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(988, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1319, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 200);
  } catch (e) { handleSoftError(e, 'audio-init'); }
}

export function playFanfare() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (e) { handleSoftError(e, 'audio-init'); }
}
