import { handleSoftError } from '../../lib/errorHandler';
import { isSoundEnabled } from '../../hooks/useGameSound.js';

export function playTone(freq, type = 'square', duration = 0.2, gain = 0.12) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), duration * 1000 + 200);
  } catch (e) { handleSoftError(e, 'audio-tone'); }
}

export function playTick() { playTone(880, 'square', 0.05, 0.08); }

export function playCardReveal(index) {
  setTimeout(() => playTone(300 + index * 60, 'square', 0.3, 0.1), index * 120);
}

export function playBossRoar() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.type = 'sawtooth'; osc1.frequency.value = 60;
    g1.gain.setValueAtTime(0.2, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc1.start(); osc1.stop(ctx.currentTime + 1.2);
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.type = 'square'; osc2.frequency.value = 1200;
    g2.gain.setValueAtTime(0.0, ctx.currentTime + 0.3);
    g2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc2.start(ctx.currentTime + 0.3); osc2.stop(ctx.currentTime + 1.5);
    setTimeout(() => ctx.close(), 2000);
  } catch (e) { handleSoftError(e, 'audio-expose'); }
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => playTone(f, 'square', 0.3, 0.12), i * 100)
  );
}

export function startSuspenseMusic(loopRef) {
  let active = true;
  loopRef.current = { stop: () => { active = false; } };
  const notes = [220, 233, 220, 208, 196, 208, 220];
  let i = 0;
  function playNext() {
    if (!active) return;
    playTone(notes[i % notes.length], 'triangle', 0.4, 0.06);
    i++;
    setTimeout(playNext, 450);
  }
  playNext();
}
