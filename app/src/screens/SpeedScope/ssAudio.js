import { handleSoftError } from '../../lib/errorHandler';
import { isSoundEnabled } from '../../hooks/useGameSound.js';

export function playTick() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
    setTimeout(() => ctx.close(), 200);
  } catch (e) { handleSoftError(e, 'audio-tick'); }
}

export function playFastTick() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 1320;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
    setTimeout(() => ctx.close(), 200);
  } catch (e) { handleSoftError(e, 'audio-fast-tick'); }
}

export function playBuzzer() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const low = ctx.createOscillator(); const gl = ctx.createGain();
    low.connect(gl); gl.connect(ctx.destination);
    low.type = 'sawtooth'; low.frequency.value = 55;
    gl.gain.setValueAtTime(0.3, ctx.currentTime);
    gl.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    low.start(); low.stop(ctx.currentTime + 0.5);
    const hi = ctx.createOscillator(); const gh = ctx.createGain();
    hi.connect(gh); gh.connect(ctx.destination);
    hi.type = 'square'; hi.frequency.value = 880;
    gh.gain.setValueAtTime(0.2, ctx.currentTime);
    gh.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    hi.start(); hi.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 800);
  } catch (e) { handleSoftError(e, 'audio-buzzer'); }
}

export function playReveal() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [392, 523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch (e) { handleSoftError(e, 'audio-reveal'); }
}

export function playSpeedWinner() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) { handleSoftError(e, 'audio-winner'); }
}
