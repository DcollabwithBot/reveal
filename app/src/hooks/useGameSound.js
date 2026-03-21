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

/**
 * SOUND SYSTEM HIERARCHY — Reveal (Sprint D audit)
 * =================================================
 *
 * Reveal has two co-existing sound systems:
 *
 * 1. PROP-BASED (Session.jsx + shared/useSound.js)
 *    - Session.jsx receives `sound` prop from App.jsx
 *    - App.jsx calls useSound() from shared/useSound.js (separate file)
 *    - This is the ORIGINAL system from before Sprint B
 *    - It manages its own AudioContext via useRef, NOT this hook
 *    - The isSoundEnabled() export from THIS file IS checked by inline
 *      audio calls in other screens (e.g. playTick(), playWinner())
 *
 * 2. HOOK-BASED (all Sprint B/C/D screens via useGameSound.js)
 *    - All new game mode screens call useGameSound() directly
 *    - Standard: const { soundEnabled, toggleSound, playSound } = useGameSound();
 *    - Persisted in localStorage under key 'reveal_sound_enabled'
 *    - SoundToggle component reads from this hook
 *    - isSoundEnabled() export allows inline Web Audio calls to respect toggle
 *
 * SHARED STATE:
 *    Both systems share the SAME localStorage key ('reveal_sound_enabled'),
 *    so toggling SoundToggle in ANY screen silences ALL sounds, including
 *    Session.jsx's prop-based inline audio. They are intentionally kept
 *    separate to avoid a full prop-drilling refactor of Session.jsx.
 *
 * FUTURE:
 *    When Session.jsx is refactored, replace the `sound` prop with
 *    useGameSound() hook directly, and remove shared/useSound.js.
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
