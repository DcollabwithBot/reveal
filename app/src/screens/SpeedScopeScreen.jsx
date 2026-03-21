/**
 * C3: Speed Scope Game Mode
 * session_type: 'speed_scope'
 *
 * 4-step flow:
 *  1. RUNDE 1 — SPEED: 10 sek per item, ingen diskussion
 *  2. RUNDE 2 — DISCUSS: 2 min per item + re-vote
 *  3. Delta Analyse — speed vs. discussed, Hidden Complexity flag
 *  4. Velocity Stats — items/min + accuracy leaderboard
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../shared/constants.js';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

// ── CSS injection ─────────────────────────────────────────────────────────────
let ssStylesInjected = false;
function injectSSStyles() {
  if (ssStylesInjected) return;
  ssStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes ss-timerPulse {
      0%, 100% { color: var(--danger); opacity: 1; transform: scale(1); }
      50%       { color: #ff0000; opacity: 0.7; transform: scale(1.05); }
    }
    @keyframes ss-buzzerFlash {
      0%   { background: rgba(232,84,84,0.7); }
      100% { background: transparent; }
    }
    @keyframes ss-edgePulse {
      0%, 100% { box-shadow: inset 0 0 0px transparent; }
      50%       { box-shadow: inset 0 0 40px rgba(232,84,84,0.4); }
    }
    @keyframes ss-cardSelect {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.15); }
      70%  { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    @keyframes ss-barGrow {
      from { width: 0; }
    }
    @keyframes ss-screenShake {
      0%,100% { transform: translate(0); }
      10%     { transform: translate(-6px, 4px); }
      30%     { transform: translate(6px, -4px); }
      50%     { transform: translate(-5px, 5px); }
      70%     { transform: translate(5px, -3px); }
      90%     { transform: translate(-3px, 2px); }
    }
    @keyframes ss-pop {
      0%   { opacity: 0; transform: scale(0.6); }
      70%  { transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes ss-reveal {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ss-delta-badge {
      0%, 100% { box-shadow: 0 0 6px var(--danger); }
      50%       { box-shadow: 0 0 18px var(--danger), 0 0 30px var(--danger); }
    }
    @keyframes ss-speed-glow {
      0%, 100% { text-shadow: 0 0 10px #00aaff; }
      50%       { text-shadow: 0 0 25px #00aaff, 0 0 50px #00aaff; }
    }
    @keyframes ss-countUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ss-scanline {
      0%   { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    @keyframes ss-float {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-5px); }
    }
    .ss-card-selected { animation: ss-cardSelect 0.3s ease; }
    .ss-timer-urgent  { animation: ss-timerPulse 0.5s ease-in-out infinite; }
    .ss-buzzer-flash  { animation: ss-buzzerFlash 0.6s ease forwards; }
    .ss-edge-danger   { animation: ss-edgePulse 0.8s ease-in-out infinite; }
    .ss-pop           { animation: ss-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .ss-reveal        { animation: ss-reveal 0.4s ease forwards; }
    .ss-speed-title   { animation: ss-speed-glow 2s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ── Web Audio ─────────────────────────────────────────────────────────────────
function playTick() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function playFastTick() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 1320;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function playBuzzer() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Low rumble
    const low = ctx.createOscillator();
    const gl = ctx.createGain();
    low.connect(gl); gl.connect(ctx.destination);
    low.type = 'sawtooth'; low.frequency.value = 55;
    gl.gain.setValueAtTime(0.3, ctx.currentTime);
    gl.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    low.start(); low.stop(ctx.currentTime + 0.5);
    // High screech
    const hi = ctx.createOscillator();
    const gh = ctx.createGain();
    hi.connect(gh); gh.connect(ctx.destination);
    hi.type = 'square'; hi.frequency.value = 880;
    gh.gain.setValueAtTime(0.2, ctx.currentTime);
    gh.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    hi.start(); hi.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

function playReveal() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [392, 523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

function playSpeedWinner() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fibStepDelta(a, b) {
  const ia = FIBONACCI.indexOf(Number(a));
  const ib = FIBONACCI.indexOf(Number(b));
  if (ia === -1 || ib === -1) return 0;
  return Math.abs(ia - ib);
}

function avgEstimate(votes) {
  const nums = (votes || []).filter(v => typeof v === 'number' && FIBONACCI.includes(v));
  if (!nums.length) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return FIBONACCI.reduce((best, f) => Math.abs(f - mean) < Math.abs(best - mean) ? f : best, FIBONACCI[0]);
}

function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return { id: 0, name: 'YOU', lv: 3, cls: cl, hat: avatar?.helmet?.pv || cl.color, body: avatar?.armor?.pv || cl.color, btc: avatar?.boots?.pv || dk(cl.color, 60), skin: avatar?.skin || '#fdd', isP: true };
}
function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return { id: index + 1, name: name || `P${index + 1}`, lv: 1 + (index % 5), cls: cl, hat: cl.color, body: cl.color, btc: dk(cl.color, 60), skin: ['#fdd', '#fed', '#edc', '#ffe', '#fec'][index % 5], isP: false };
}

// ── Countdown Timer ───────────────────────────────────────────────────────────
function CountdownTimer({ seconds, onExpire, urgent = false }) {
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
      <div
        className={isUrgent ? 'ss-timer-urgent' : ''}
        style={{
          fontFamily: PF,
          fontSize: 72,
          color,
          lineHeight: 1,
          textShadow: `0 0 20px ${color}88`,
          letterSpacing: 4,
        }}
      >
        {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : s}
      </div>
      {isUrgent && (
        <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)', letterSpacing: 2, marginTop: 4 }}>
          HURRY UP!
        </div>
      )}
    </div>
  );
}

// ── Achievement Popup ─────────────────────────────────────────────────────────
function AchievementPopup({ name, icon, desc, xp, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' }}>
      <div className="ss-pop" style={{
        background: 'var(--bg2)', border: '2px solid var(--epic)', borderRadius: 14,
        padding: '28px 36px', textAlign: 'center', maxWidth: 320, pointerEvents: 'auto',
        boxShadow: '0 0 30px rgba(139,92,246,0.4)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{icon || '🏆'}</div>
        <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ACHIEVEMENT UNLOCKED</div>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--epic)', marginBottom: 6 }}>{name}</div>
        <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginBottom: 12 }}>{desc}</div>
        <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', background: 'rgba(184,147,46,0.1)', border: '1px solid rgba(184,147,46,0.3)', borderRadius: 4, padding: '6px 12px', display: 'inline-block', marginBottom: 12 }}>+{xp} XP</div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', fontFamily: PF, fontSize: 7, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}>NICE</button>
      </div>
    </div>
  );
}

// ── Fibonacci Card ────────────────────────────────────────────────────────────
function FibCard({ value, selected, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={selected ? 'ss-card-selected' : ''}
      style={{
        fontFamily: PF, fontSize: 18, minWidth: 64, minHeight: 80,
        background: selected ? 'linear-gradient(135deg, #00aaff22, #00aaff44)' : 'var(--bg2)',
        border: selected ? '3px solid #00aaff' : '2px solid var(--border2)',
        borderBottom: selected ? '3px solid #00aaff' : '4px solid var(--border)',
        borderRight: selected ? '3px solid #00aaff' : '4px solid var(--border)',
        color: selected ? '#00aaff' : 'var(--text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !selected ? 0.5 : 1,
        boxShadow: selected ? '0 0 12px #00aaff44' : 'none',
        transition: 'all 0.15s',
        padding: '12px 8px',
      }}
    >
      {value}
    </button>
  );
}

// ── Step 1: Speed Round ───────────────────────────────────────────────────────
function StepSpeed({ items, currentItemIndex, onVote, votedItems, isGM, participantCount, voteCount, onGMAdvance }) {
  const item = items[currentItemIndex];
  const myVote = votedItems[item?.id];
  const itemStartTime = useRef(Date.now());

  useEffect(() => { itemStartTime.current = Date.now(); }, [currentItemIndex]);

  if (!item) return null;

  function handleVote(val) {
    if (myVote) return;
    const responseTime = Date.now() - itemStartTime.current;
    onVote(item.id, val, responseTime);
  }

  return (
    <div className={!myVote ? 'ss-edge-danger' : ''} style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden', padding: '24px 20px' }}>
      {/* Scanline */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 14, color: '#00aaff', letterSpacing: 2 }}>⚡ SPEED ROUND</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--danger)', marginTop: 4 }}>NO DISCUSSION!</div>
          </div>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)' }}>
            {currentItemIndex + 1}/{items.length}
          </div>
        </div>

        {/* Item */}
        <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEM TO ESTIMATE</div>
          <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)' }}>{item.title}</div>
          {item.description && <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginTop: 6 }}>{item.description}</div>}
        </div>

        {/* Timer */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {!myVote ? (
            <CountdownTimer seconds={10} onExpire={() => { if (!myVote) onVote(item.id, null, 10000); }} />
          ) : (
            <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--jade)' }}>LOCKED IN ✓</div>
          )}
        </div>

        {/* Vote count */}
        <div style={{ textAlign: 'center', fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
          {voteCount}/{participantCount} estimated
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {FIBONACCI.map(f => (
            <FibCard key={f} value={f} selected={myVote === f} onClick={() => handleVote(f)} disabled={!!myVote} />
          ))}
        </div>

        {myVote && (
          <div className="ss-reveal" style={{ textAlign: 'center', fontFamily: VT, fontSize: 22, color: 'var(--jade)', padding: 16, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8 }}>
            You estimated: <span style={{ fontFamily: PF, fontSize: 18, color: 'var(--jade)' }}>{myVote}</span>
          </div>
        )}

        {isGM && voteCount === participantCount && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={onGMAdvance} style={{ fontFamily: PF, fontSize: 9, color: 'var(--bg)', background: '#00aaff', border: '3px solid #00aaff', borderBottom: '5px solid #0077bb', padding: '12px 24px', cursor: 'pointer' }}>
              NEXT ITEM →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Discuss Round ─────────────────────────────────────────────────────
function StepDiscuss({ items, currentItemIndex, onVote, votedItems, mySpeedEstimates, isGM, participantCount, voteCount, showSpeedVotes, allRound1, onGMAdvance, onToggleShowSpeed }) {
  const item = items[currentItemIndex];
  const myVote = votedItems[item?.id];
  const mySpeed = mySpeedEstimates[item?.id];

  if (!item) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--jade)', letterSpacing: 2 }}>💬 DISCUSS ROUND</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>Discuss first, then vote!</div>
          </div>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)' }}>{currentItemIndex + 1}/{items.length}</div>
        </div>

        {/* Timer */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <CountdownTimer seconds={120} onExpire={() => isGM && onGMAdvance()} />
        </div>

        {/* Item */}
        <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEM</div>
          <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)' }}>{item.title}</div>
        </div>

        {/* My speed estimate */}
        {mySpeed && (
          <div style={{ textAlign: 'center', marginBottom: 16, fontFamily: VT, fontSize: 20, color: '#00aaff' }}>
            Your Speed Estimate: <span style={{ fontFamily: PF, fontSize: 14 }}>{mySpeed}</span>
          </div>
        )}

        {/* Show/hide speed votes for GM */}
        {isGM && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button onClick={onToggleShowSpeed} style={{ fontFamily: PF, fontSize: 7, color: 'var(--text2)', background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
              {showSpeedVotes ? 'HIDE SPEED VOTES' : 'REVEAL SPEED VOTES'}
            </button>
          </div>
        )}

        {/* Speed votes if shown */}
        {showSpeedVotes && allRound1[item.id] && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {allRound1[item.id].map((v, i) => (
              <div key={i} style={{ background: 'var(--bg3)', border: '2px solid #00aaff44', borderRadius: 6, padding: '8px 12px', fontFamily: PF, fontSize: 12, color: '#00aaff' }}>{v}</div>
            ))}
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {FIBONACCI.map(f => (
            <FibCard key={f} value={f} selected={myVote === f} onClick={() => !myVote && onVote(item.id, f)} disabled={!!myVote} />
          ))}
        </div>

        {/* Vote count */}
        <div style={{ textAlign: 'center', fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
          {voteCount}/{participantCount} voted
        </div>

        {myVote && (
          <div className="ss-reveal" style={{ textAlign: 'center', fontFamily: VT, fontSize: 22, color: 'var(--jade)', marginBottom: 16 }}>
            Discussed vote: <span style={{ fontFamily: PF, fontSize: 16, color: 'var(--jade)' }}>{myVote}</span>
          </div>
        )}

        {isGM && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={onGMAdvance} style={{ fontFamily: PF, fontSize: 9, color: 'var(--bg)', background: 'var(--jade)', border: '3px solid var(--jade)', borderBottom: '5px solid var(--bg)', padding: '10px 20px', cursor: 'pointer' }}>
              {voteCount === participantCount ? 'NEXT ITEM →' : 'SKIP / NEXT →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Delta Analysis ────────────────────────────────────────────────────
function StepDelta({ items, round1Estimates, round2Estimates, onContinue, onApplyEstimates, isGM }) {
  useEffect(() => { playReveal(); }, []);

  const deltas = items.map(item => {
    const avg1 = avgEstimate(round1Estimates[item.id] || []);
    const avg2 = avgEstimate(round2Estimates[item.id] || []);
    const delta = avg1 != null && avg2 != null ? fibStepDelta(avg1, avg2) : 0;
    return { item, avg1, avg2, delta, hiddenComplexity: delta >= 2 };
  }).sort((a, b) => b.delta - a.delta);

  const hiddenCount = deltas.filter(d => d.hiddenComplexity).length;
  const totalSpeed = deltas.reduce((s, d) => s + (d.avg1 || 0), 0);
  const totalDiscussed = deltas.reduce((s, d) => s + (d.avg2 || 0), 0);
  const maxTotal = Math.max(totalSpeed, totalDiscussed, 1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>🔍 DELTA ANALYSIS</div>
          {hiddenCount > 0 && (
            <div className="ss-pop" style={{ display: 'inline-block', background: 'rgba(232,84,84,0.15)', border: '1px solid var(--danger)', borderRadius: 6, padding: '6px 16px', fontFamily: PF, fontSize: 8, color: 'var(--danger)' }}>
              ⚠ {hiddenCount} HIDDEN COMPLEXITY {hiddenCount === 1 ? 'ITEM' : 'ITEMS'}
            </div>
          )}
        </div>

        {/* Summary bars */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 12 }}>TOTAL ESTIMATES</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: '#00aaff', width: 80 }}>⚡ SPEED</div>
            <div style={{ flex: 1, height: 20, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(totalSpeed / maxTotal) * 100}%`, background: '#00aaff', animation: 'ss-barGrow 0.8s ease', borderRadius: 4 }} />
            </div>
            <div style={{ fontFamily: PF, fontSize: 10, color: '#00aaff', width: 40, textAlign: 'right' }}>{totalSpeed}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--jade)', width: 80 }}>💬 DISCUSS</div>
            <div style={{ flex: 1, height: 20, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(totalDiscussed / maxTotal) * 100}%`, background: 'var(--jade)', animation: 'ss-barGrow 0.8s ease 0.3s both', borderRadius: 4 }} />
            </div>
            <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)', width: 40, textAlign: 'right' }}>{totalDiscussed}</div>
          </div>
        </div>

        {/* Per-item deltas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {deltas.map(({ item, avg1, avg2, delta, hiddenComplexity }, i) => (
            <div
              key={item.id}
              className="ss-reveal"
              style={{
                background: 'var(--bg2)',
                border: hiddenComplexity ? '2px solid var(--danger)' : '1px solid var(--border2)',
                borderRadius: 8,
                padding: '12px 16px',
                animation: `ss-reveal 0.4s ease ${i * 0.08}s both`,
                boxShadow: hiddenComplexity ? '0 0 12px rgba(232,84,84,0.2)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontFamily: VT, fontSize: 16, color: '#00aaff' }}>⚡ {avg1 ?? '?'}</span>
                    <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--jade)' }}>💬 {avg2 ?? '?'}</span>
                    {delta > 0 && (
                      <span style={{ fontFamily: PF, fontSize: 7, color: delta >= 2 ? 'var(--danger)' : 'var(--warn)', background: delta >= 2 ? 'rgba(232,84,84,0.1)' : 'rgba(232,160,32,0.1)', border: `1px solid ${delta >= 2 ? 'var(--danger)' : 'var(--warn)'}`, borderRadius: 4, padding: '2px 8px' }}>
                        Δ{delta} step{delta > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {hiddenComplexity && (
                  <div className="ss-delta-badge" style={{ fontFamily: PF, fontSize: 7, color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 4, padding: '6px 10px', whiteSpace: 'nowrap', animation: 'ss-delta-badge 2s ease-in-out infinite' }}>
                    🕵️ HIDDEN<br/>COMPLEXITY
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {isGM && (
            <button onClick={onApplyEstimates} style={{ fontFamily: PF, fontSize: 8, color: 'var(--text)', background: 'var(--bg2)', border: '2px solid var(--border2)', borderBottom: '4px solid var(--border)', padding: '10px 18px', cursor: 'pointer' }}>
              APPLY DISCUSSED ESTIMATES
            </button>
          )}
          <button onClick={onContinue} style={{ fontFamily: PF, fontSize: 8, color: 'var(--bg)', background: 'var(--gold)', border: '3px solid var(--gold)', borderBottom: '5px solid var(--bg)', padding: '12px 24px', cursor: 'pointer' }}>
            VIEW STATS →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Velocity Stats ────────────────────────────────────────────────────
function StepStats({ items, round1Estimates, round2Estimates, participants, responseTimes, onBack, sessionId }) {
  const [animated, setAnimated] = useState(false);
  const [shownAchievement, setShownAchievement] = useState(null);

  useEffect(() => {
    setTimeout(() => setAnimated(true), 100);
    playSpeedWinner();
  }, []);

  // Compute stats
  const totalItems = items.length;
  // Assume ~10 sec per item in speed round
  const speedTimeMin = (totalItems * 10) / 60;
  const itemsPerMin = speedTimeMin > 0 ? (totalItems / speedTimeMin).toFixed(1) : '—';

  const accurateCount = items.filter(item => {
    const avg1 = avgEstimate(round1Estimates[item.id] || []);
    const avg2 = avgEstimate(round2Estimates[item.id] || []);
    if (avg1 == null || avg2 == null) return false;
    return fibStepDelta(avg1, avg2) <= 1;
  }).length;
  const accuracyPct = totalItems > 0 ? Math.round((accurateCount / totalItems) * 100) : 0;
  const accuracyColor = accuracyPct >= 70 ? 'var(--jade)' : accuracyPct >= 40 ? 'var(--warn)' : 'var(--danger)';

  const hiddenItems = items.filter(item => {
    const avg1 = avgEstimate(round1Estimates[item.id] || []);
    const avg2 = avgEstimate(round2Estimates[item.id] || []);
    if (avg1 == null || avg2 == null) return false;
    return fibStepDelta(avg1, avg2) >= 2;
  });

  // Speed leaders by response time
  const leaders = participants.map(p => {
    const rt = responseTimes[p.user_id || p.id];
    return { ...p, avgResponseMs: rt ? (rt.reduce((a, b) => a + b, 0) / rt.length) : 9999999 };
  }).sort((a, b) => a.avgResponseMs - b.avgResponseMs);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: PF, fontSize: 16, color: 'var(--gold)', letterSpacing: 2, marginBottom: 4 }}>📊 VELOCITY STATS</div>
          <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)' }}>Speed round analysis complete</div>
        </div>

        {/* Key metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEMS / MINUTE</div>
            <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 24, color: '#00aaff', animation: animated ? 'ss-countUp 0.6s ease' : 'none' }}>
              ⚡ {itemsPerMin}
            </div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)', marginTop: 4 }}>speed round</div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ACCURACY SCORE</div>
            <div style={{ fontFamily: PF, fontSize: 24, color: accuracyColor, animation: animated ? 'ss-countUp 0.6s ease 0.2s both' : 'none' }}>
              {accuracyPct}%
            </div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)', marginTop: 4 }}>within ±1 step</div>
          </div>
        </div>

        {/* Hidden complexity items */}
        {hiddenItems.length > 0 && (
          <div style={{ background: 'rgba(232,84,84,0.06)', border: '1px solid var(--danger)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)', marginBottom: 12 }}>🕵️ HIDDEN COMPLEXITY ITEMS</div>
            {hiddenItems.map((item, i) => {
              const avg1 = avgEstimate(round1Estimates[item.id] || []);
              const avg2 = avgEstimate(round2Estimates[item.id] || []);
              const delta = fibStepDelta(avg1, avg2);
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text)' }}>{item.title}</span>
                  <span style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)' }}>+{delta} step{delta > 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Speed leaders */}
        {leaders.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 12 }}>⚡ SPEED DEMONS</div>
            {leaders.map((p, i) => (
              <div key={p.id || p.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', width: 20 }}>#{i + 1}</span>
                  <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--text)' }}>{p.name || p.display_name || `P${i + 1}`}</span>
                  {i === 0 && <span style={{ fontSize: 18 }}>⚡</span>}
                </div>
                <span style={{ fontFamily: PF, fontSize: 7, color: i === 0 ? '#00aaff' : 'var(--text3)' }}>
                  {p.avgResponseMs < 9999999 ? `${(p.avgResponseMs / 1000).toFixed(1)}s avg` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Achievements */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {accuracyPct === 100 && (
            <div className="ss-pop" style={{ display: 'inline-block', background: 'rgba(184,147,46,0.1)', border: '1px solid var(--gold)', borderRadius: 8, padding: '10px 20px', marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--gold)', display: 'block', marginTop: 4 }}>CALIBRATED UNLOCKED!</span>
            </div>
          )}
          {hiddenItems.length >= 3 && (
            <div className="ss-pop" style={{ display: 'inline-block', background: 'rgba(232,84,84,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 20px', marginLeft: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🕵️</span>
              <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--danger)', display: 'block', marginTop: 4 }}>COMPLEXITY HUNTER!</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 8, color: 'var(--text2)', background: 'none', border: '2px solid var(--border2)', padding: '12px 24px', cursor: 'pointer' }}>
            ← BACK TO SESSION
          </button>
        </div>

        {/* Post-session PM summary */}
        <PostSessionSummary
          sessionType="speed_scope"
          results={{
            hidden_complexity_count: hiddenItems.length,
            velocity: itemsPerMin,
          }}
          approvalPending={false}
          approvalItems={[]}
          onBack={onBack}
          sessionId={sessionId}
        />
      </div>

      {shownAchievement && <AchievementPopup {...shownAchievement} onClose={() => setShownAchievement(null)} />}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SpeedScopeScreen({ sessionId, user, avatar, onBack }) {
  const xpBarRef = useRef(null);
  const { soundEnabled, toggleSound } = useGameSound();
  const [step, setStep] = useState('loading'); // loading | lobby | speed | discuss | delta | stats
  const [items, setItems] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isGM, setIsGM] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [round1Votes, setRound1Votes] = useState({}); // { itemId: estimate }
  const [round2Votes, setRound2Votes] = useState({}); // { itemId: estimate }
  const [round1All, setRound1All] = useState({}); // { itemId: [votes] }
  const [round2All, setRound2All] = useState({}); // { itemId: [votes] }
  const [voteCount, setVoteCount] = useState(0);
  const [showSpeedVotes, setShowSpeedVotes] = useState(false);
  const [responseTimes, setResponseTimes] = useState({});
  const [achievement, setAchievement] = useState(null);
  const channelRef = useRef(null);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1200);
  }
  function triggerLoot() { setLootActive(true); setTimeout(() => setLootActive(false), 2000); }

  useEffect(() => {
    injectSSStyles();
    loadData();
    return () => { channelRef.current?.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      // Fetch session items
      const { data: sessionItems } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      // Fetch participants
      const { data: parts } = await supabase
        .from('session_participants')
        .select('*, profiles(display_name, avatar_data)')
        .eq('session_id', sessionId);

      if (sessionItems) setItems(sessionItems);
      if (parts) {
        setParticipants(parts);
        const me = parts.find(p => p.user_id === user?.id);
        if (me) setIsGM(me.is_host);
      }

      setupRealtime();
      setStep('lobby');
    } catch (err) {
      console.error('SpeedScope load error:', err);
      setStep('lobby');
    }
  }

  function setupRealtime() {
    const ch = supabase.channel('speed-scope-' + sessionId)
      .on('broadcast', { event: 'GAME_START' }, () => setStep('speed'))
      .on('broadcast', { event: 'NEXT_ITEM' }, ({ payload }) => {
        setCurrentItemIndex(payload.itemIndex || 0);
        setVoteCount(0);
      })
      .on('broadcast', { event: 'ROUND2_START' }, () => {
        setStep('discuss');
        setCurrentItemIndex(0);
        setVoteCount(0);
      })
      .on('broadcast', { event: 'DELTA_READY' }, () => setStep('delta'))
      .on('broadcast', { event: 'STATS_READY' }, () => setStep('stats'))
      .on('broadcast', { event: 'VOTE_CAST' }, () => setVoteCount(c => c + 1))
      .subscribe();
    channelRef.current = ch;
  }

  async function handleSpeedVote(itemId, estimate, responseTimeMs) {
    if (!estimate) return;
    setRound1Votes(v => ({ ...v, [itemId]: estimate }));
    setResponseTimes(rt => {
      const existing = rt[user?.id] || [];
      return { ...rt, [user?.id]: [...existing, responseTimeMs] };
    });

    await supabase.from('speed_estimates').upsert({
      session_id: sessionId,
      item_id: itemId,
      user_id: user?.id,
      estimate,
      round: 1,
      response_time_ms: responseTimeMs,
    }, { onConflict: 'session_id,item_id,user_id,round' });

    channelRef.current?.send({ type: 'broadcast', event: 'VOTE_CAST', payload: { itemId } });
  }

  async function handleDiscussVote(itemId, estimate) {
    setRound2Votes(v => ({ ...v, [itemId]: estimate }));

    await supabase.from('speed_estimates').upsert({
      session_id: sessionId,
      item_id: itemId,
      user_id: user?.id,
      estimate,
      round: 2,
    }, { onConflict: 'session_id,item_id,user_id,round' });

    channelRef.current?.send({ type: 'broadcast', event: 'VOTE_CAST', payload: { itemId } });
  }

  async function gmAdvanceSpeed() {
    const nextIdx = currentItemIndex + 1;
    if (nextIdx >= items.length) {
      // All items done, fetch round 1 results
      const { data } = await supabase
        .from('speed_estimates')
        .select('item_id, estimate, user_id')
        .eq('session_id', sessionId)
        .eq('round', 1);

      const byItem = {};
      (data || []).forEach(e => {
        if (!byItem[e.item_id]) byItem[e.item_id] = [];
        byItem[e.item_id].push(e.estimate);
      });
      setRound1All(byItem);

      channelRef.current?.send({ type: 'broadcast', event: 'ROUND2_START', payload: {} });
    } else {
      setCurrentItemIndex(nextIdx);
      setVoteCount(0);
      channelRef.current?.send({ type: 'broadcast', event: 'NEXT_ITEM', payload: { itemIndex: nextIdx } });
    }
  }

  async function gmAdvanceDiscuss() {
    const nextIdx = currentItemIndex + 1;
    if (nextIdx >= items.length) {
      // All discuss done, compute delta
      const { data } = await supabase
        .from('speed_estimates')
        .select('item_id, estimate, round, user_id')
        .eq('session_id', sessionId);

      const r1 = {}, r2 = {};
      (data || []).forEach(e => {
        if (e.round === 1) { if (!r1[e.item_id]) r1[e.item_id] = []; r1[e.item_id].push(e.estimate); }
        if (e.round === 2) { if (!r2[e.item_id]) r2[e.item_id] = []; r2[e.item_id].push(e.estimate); }
      });
      setRound1All(r1);
      setRound2All(r2);

      channelRef.current?.send({ type: 'broadcast', event: 'DELTA_READY', payload: {} });
      // Game soul: speed round complete
      addDmg('⚡ +XP', '#8b5cf6');
      triggerLoot();
    } else {
      setCurrentItemIndex(nextIdx);
      setVoteCount(0);
      channelRef.current?.send({ type: 'broadcast', event: 'NEXT_ITEM', payload: { itemIndex: nextIdx } });
    }
  }

  async function startGame() {
    channelRef.current?.send({ type: 'broadcast', event: 'GAME_START', payload: {} });
    setStep('speed');
  }

  // Shared XP bar + game soul overlays shown across all steps
  const xpBarEl = user?.id ? (
    <>
      <XPBadgeNotifier userId={user.id} />
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
        <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
        <GameXPBar userId={user.id} ref={xpBarRef} />
      </div>
    </>
  ) : null;
  const gameSoulOverlays = (
    <>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '⚡', label: '+XP', color: '#8b5cf6' }, { icon: '🎯', label: 'SPEED', color: C.gld }]} />
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
        {NPC_TEAM.map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
      </div>
    </>
  );

  if (step === 'loading') {
    return (
      <Scene mc="#8b5cf6">
        <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {xpBarEl}
          {gameSoulOverlays}
          <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--text3)' }}>LOADING...</div>
        </div>
      </Scene>
    );
  }

  if (step === 'lobby') {
    return (
      <Scene mc="#8b5cf6">
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '24px 20px' }}>
        {xpBarEl}
        <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 18, color: '#00aaff', letterSpacing: 2, marginBottom: 8 }}>⚡ SPEED SCOPE</div>
          <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 32 }}>Estimate fast. Reflect slow. Find hidden complexity.</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 32 }}>
            {participants.map((p, i) => {
              const member = makeAnonMember(i, p.profiles?.display_name || p.display_name);
              return <div key={p.id} className="ss-pop" style={{ textAlign: 'center', animation: `ss-pop 0.4s ease ${i * 0.1}s both` }}><Sprite m={member} size={1.5} /></div>;
            })}
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 8 }}>HOW IT WORKS</div>
            <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', lineHeight: 1.6 }}>
              Round 1: 10 seconds per item. No discussion. Just gut feeling.<br/>
              Round 2: 2 minutes per item. Discuss, then re-vote.<br/>
              Delta: See where speed and discussion differ → hidden complexity!
            </div>
          </div>

          {isGM && (
            <button onClick={startGame} style={{ fontFamily: PF, fontSize: 10, color: 'var(--bg)', background: '#00aaff', border: '3px solid #00aaff', borderBottom: '6px solid #004488', padding: '14px 32px', cursor: 'pointer', letterSpacing: 1 }}>
              ⚡ START SPEED ROUND
            </button>
          )}
          {!isGM && <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text3)' }}>Waiting for GM to start...</div>}

          <div style={{ marginTop: 24 }}>
            <button onClick={onBack} style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', padding: '8px 16px', cursor: 'pointer' }}>
              ← BACK
            </button>
          </div>
        </div>
        {xpBarEl}
        {gameSoulOverlays}
      </div>
      </Scene>
    );
  }

  if (step === 'speed') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepSpeed
        items={items}
        currentItemIndex={currentItemIndex}
        onVote={handleSpeedVote}
        votedItems={round1Votes}
        isGM={isGM}
        participantCount={participants.length}
        voteCount={voteCount}
        onGMAdvance={gmAdvanceSpeed}
      />
      </Scene>
    );
  }

  if (step === 'discuss') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepDiscuss
          items={items}
          currentItemIndex={currentItemIndex}
          onVote={handleDiscussVote}
          votedItems={round2Votes}
          mySpeedEstimates={round1Votes}
          isGM={isGM}
          participantCount={participants.length}
          voteCount={voteCount}
          showSpeedVotes={showSpeedVotes}
          allRound1={round1All}
          onGMAdvance={gmAdvanceDiscuss}
          onToggleShowSpeed={() => setShowSpeedVotes(v => !v)}
        />
      </Scene>
    );
  }

  if (step === 'delta') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepDelta
          items={items}
          round1Estimates={round1All}
          round2Estimates={round2All}
          isGM={isGM}
          onContinue={() => {
            channelRef.current?.send({ type: 'broadcast', event: 'STATS_READY', payload: {} });
            setStep('stats');
          }}
          onApplyEstimates={async () => {
            // Optional: update session_items with discussed estimates
            for (const item of items) {
              const avg = avgEstimate(round2All[item.id] || []);
              if (avg) {
                await supabase.from('session_items').update({ estimate: avg }).eq('id', item.id);
              }
            }
          }}
        />
      </Scene>
    );
  }

  if (step === 'stats') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepStats
          items={items}
          round1Estimates={round1All}
          round2Estimates={round2All}
          participants={participants}
          responseTimes={responseTimes}
          onBack={onBack}
          sessionId={sessionId}
        />
      </Scene>
    );
  }

  return null;
}
