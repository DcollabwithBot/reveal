/**
 * useGameSound — Global sound on/off toggle + playSound wrapper
 *
 * Persists preference in localStorage under key `reveal_sound_enabled`.
 * Returns:
 *   soundEnabled  {boolean}  — current state
 *   toggleSound   {function} — flip on/off
 *   playSound     {function} — NO-OP wrapper when disabled; call like:
 *                              playSound(() => myWebAudioFn())
 *
 * Usage in any component:
 *   const { soundEnabled, toggleSound, playSound } = useGameSound();
 *   playSound(() => playTick());
 *   <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} />
 */
import { useState, useCallback } from 'react';

const LS_KEY = 'reveal_sound_enabled';

function readStorage() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function writeStorage(val) {
  try {
    localStorage.setItem(LS_KEY, String(val));
  } catch {}
}

export function useGameSound() {
  const [soundEnabled, setSoundEnabled] = useState(() => readStorage());

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      writeStorage(next);
      return next;
    });
  }, []);

  /**
   * playSound(fn) — calls fn() only when sound is enabled.
   * fn should be a zero-arg function that triggers Web Audio.
   */
  const playSound = useCallback((fn) => {
    if (!soundEnabled) return;
    try { fn(); } catch {}
  }, [soundEnabled]);

  return { soundEnabled, toggleSound, playSound };
}

// Singleton read for non-hook contexts (inline audio functions)
export function isSoundEnabled() {
  return readStorage();
}
