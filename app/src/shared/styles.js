/**
 * shared/styles.js — reusable style constants for Reveal
 *
 * Covers the ~20-30 highest-repetition inline patterns across game and PM screens.
 * Import only what you need. Do NOT import this in constants.js (circular dep).
 *
 * Usage:
 *   import { spectatorBar, fixedScanlines, gameScreenRoot, cornerControls } from '../shared/styles.js';
 *   <div style={spectatorBar}>
 */

// Note: C and PF are intentionally NOT imported here.
// The style constants in this file use plain values only — no runtime references
// to shared constants — to avoid subtle color drift when screens override C locally.

// ─────────────────────────────────────────────
// Layout
// Note: gameScreenRoot is NOT extracted here because the game screens that
// use the pattern `{ minHeight:'100vh', background: C.bg, ... }` each define
// their own local C object with different brand colors. Extracting it would
// silently change those colors. If you need a shared game root, pass the color
// explicitly via a helper function.
// ─────────────────────────────────────────────

/** Generic centered flex container */
export const centerFlex = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Centered flex column */
export const centerFlexCol = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

// ─────────────────────────────────────────────
// Fixed overlays
// ─────────────────────────────────────────────

/** Fixed full-screen overlay: transparent pointer-events, z=1 (scanlines layer) */
export const fixedScanlines = {
  position: 'fixed',
  inset: 0,
  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
  pointerEvents: 'none',
  zIndex: 1,
};

/** Fixed modal backdrop: semi-transparent dark, centered, z=1000 */
export const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0,0,0,0.5)',
  display: 'grid',
  placeItems: 'center',
};

// ─────────────────────────────────────────────
// Spectator bar (8 occurrences — most-duplicated)
// ─────────────────────────────────────────────

/** Fixed bottom spectator chip bar, used in every game screen */
export const spectatorBar = {
  position: 'fixed',
  bottom: 8,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  zIndex: 5,
  pointerEvents: 'none',
};

// ─────────────────────────────────────────────
// Corner controls (top-right HUD buttons)
// ─────────────────────────────────────────────

/** Fixed top-right icon/button cluster, zIndex 50 (most game screens) */
export const cornerControls = {
  position: 'fixed',
  top: 12,
  right: 16,
  zIndex: 50,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

/** Fixed top-right icon/button cluster, zIndex 100 (older game screens) */
export const cornerControlsHigh = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 100,
  display: 'flex',
  gap: 8,
};

// ─────────────────────────────────────────────
// Toast / floating notifications
// ─────────────────────────────────────────────

/** Fixed bottom-right toast container */
export const toastContainer = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  zIndex: 9999,
};

// ─────────────────────────────────────────────
// Wrap flex patterns
// ─────────────────────────────────────────────

/** Centered wrap flex row — common for card/option grids */
export const wrapCenterRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  justifyContent: 'center',
};

/** Centered wrap flex row, tighter gap */
export const wrapCenterRowSm = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'center',
};

// ─────────────────────────────────────────────
// Content container
// ─────────────────────────────────────────────

/** Centered content column: max-width 640, auto margin, pb 40 */
export const contentCol = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '640px',
  margin: '0 auto',
  paddingBottom: '40px',
};
