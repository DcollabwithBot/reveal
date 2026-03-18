import { useRef, useCallback } from "react";

export function useSound() {
  const r = useRef(null);
  const g = () => {
    if (!r.current) r.current = new (window.AudioContext || window.webkitAudioContext)();
    return r.current;
  };
  const b = (freq, dur, del = 0, type = "square", vol = 0.05) => {
    try {
      const c = g(), n = c.currentTime,
        o = c.createOscillator(), ga = c.createGain();
      o.type = type;
      o.connect(ga);
      ga.connect(c.destination);
      o.frequency.setValueAtTime(freq, n + del);
      ga.gain.setValueAtTime(vol, n + del);
      ga.gain.exponentialRampToValueAtTime(0.001, n + del + dur);
      o.start(n + del);
      o.stop(n + del + dur);
    } catch (e) {}
  };
  return useCallback((t) => {
    if (t === "click") b(700, 0.08);
    else if (t === "select") { b(523, 0.12); b(659, 0.12, 0.08); b(784, 0.15, 0.16); }
    else if (t === "attack") { b(200, 0.06, 0, "sawtooth", 0.08); b(400, 0.06, 0.04, "square", 0.06); b(800, 0.08, 0.08); }
    else if (t === "hit") { b(120, 0.12, 0, "sawtooth", 0.1); b(80, 0.15, 0.08, "sawtooth", 0.08); }
    else if (t === "spell") { [523, 784, 1047, 1319].forEach((f, i) => b(f, 0.1, i * 0.06, "sine", 0.06)); }
    else if (t === "reveal") { [200, 300, 400, 600, 800, 1200].forEach((f, i) => b(f, 0.12, i * 0.06, "sine", 0.07)); }
    else if (t === "countdown") b(440, 0.12, 0, "sine", 0.08);
    else if (t === "countgo") { [523, 659, 784, 1047].forEach((f, i) => b(f, 0.15, i * 0.08, "sine", 0.09)); }
    else if (t === "boom") { b(80, 0.3, 0, "sawtooth", 0.12); b(60, 0.4, 0.1, "sawtooth", 0.1); b(40, 0.5, 0.2, "sawtooth", 0.08); }
    else if (t === "victory") { [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => b(f, 0.2, i * 0.12, "sine", 0.07)); }
    else if (t === "achieve") { b(1047, 0.1, 0, "sine", 0.07); b(1319, 0.1, 0.1, "sine", 0.07); b(1568, 0.15, 0.2, "sine", 0.07); }
    else if (t === "loot") { [392, 523, 659, 784].forEach((f, i) => b(f, 0.12, i * 0.08, "sine", 0.06)); }
    else if (t === "powerup") { [523, 784, 1047].forEach((f, i) => b(f, 0.1, i * 0.08, "sine", 0.07)); }
    else if (t === "warning") { b(200, 0.15, 0, "sawtooth", 0.06); b(150, 0.2, 0.15, "sawtooth", 0.06); }
    else if (t === "combo") { b(784, 0.08, 0, "sine", 0.07); b(1047, 0.1, 0.08, "sine", 0.07); }
    else if (t === "heartbeat") { b(60, 0.15, 0, "sine", 0.1); b(60, 0.15, 0.25, "sine", 0.07); }
    else if (t === "equip") { b(400, 0.08, 0, "sine", 0.06); b(600, 0.08, 0.06, "sine", 0.06); b(800, 0.1, 0.12, "sine", 0.06); }
    else if (t === "enter") { [262, 330, 392, 523].forEach((f, i) => b(f, 0.12, i * 0.1, "sine", 0.06)); }
    else if (t === "boss") { b(100, 0.3, 0, "sawtooth", 0.1); b(60, 0.4, 0.2, "sawtooth", 0.08); }
    else if (t === "npc") { b(523, 0.08, 0, "sine", 0.04); b(659, 0.1, 0.08, "sine", 0.04); }
    else if (t === "dice") { b(300, 0.05, 0, "square", 0.06); b(500, 0.05, 0.05, "square", 0.06); }
    else if (t === "chest") { [392, 523, 659, 784].forEach((f, i) => b(f, 0.1, i * 0.07, "sine", 0.06)); }
    else if (t === "door") { b(150, 0.2, 0, "sine", 0.08); b(200, 0.15, 0.15, "sine", 0.06); b(300, 0.2, 0.3, "sine", 0.05); }
    else if (t === "coin") { b(988, 0.08, 0, "sine", 0.06); b(1319, 0.12, 0.06, "sine", 0.06); }
  }, []);
}
