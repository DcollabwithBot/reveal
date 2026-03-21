import { handleSoftError } from "../lib/errorHandler";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getDraftState, submitDraftPicks, submitPriorityVotes, finalizeDraft } from '../lib/api';
import { fetchRawParticipants } from '../lib/sessionHelpers.js';
import { Scene, Sprite, DmgNum, LootDrops } from '../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../shared/constants.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';

// ── Draft CSS ─────────────────────────────────────────────────────────────────
let sdStylesInjected = false;
function injectDraftStyles() {
  if (sdStylesInjected) return;
  sdStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes sd-screenShake {
      0%, 100% { transform: translate(0, 0); }
      20%       { transform: translate(-5px, 0); }
      40%       { transform: translate(5px, 0); }
      60%       { transform: translate(-3px, 0); }
      80%       { transform: translate(3px, 0); }
    }
    @keyframes sd-flash-red { 0%,100%{background:transparent} 50%{background:rgba(255,68,68,0.25)} }
    @keyframes sd-flash-green { 0%,100%{background:transparent} 50%{background:rgba(0,200,150,0.25)} }
    .sd-shake { animation: sd-screenShake 0.5s ease-in-out; }
    .sd-flash-red { animation: sd-flash-red 0.5s ease; }
    .sd-flash-green { animation: sd-flash-green 1s ease; }
  `;
  document.head.appendChild(s);
}

// ── Simple coin sound ─────────────────────────────────────────────────────────
function playCoin() {
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
function playFanfare() {
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

const STEPS = ['lobby', 'priority', 'draft', 'summary'];
const PRIORITY_TOKENS = 5;
const VOTE_TIMER_SECONDS = 60;
const TSHIRT_MAP = { S: 2, M: 5, L: 8, XL: 13 };
const QUICK_ESTIMATE_SECONDS = 15;

// ── Quick Estimate Modal ──────────────────────────────────────────────────────
function QuickEstimateModal({ item, onEstimate, onCancel }) {
  const [votes, setVotes] = useState({});
  const [timer, setTimer] = useState(QUICK_ESTIMATE_SECONDS);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (timer <= 0 && !submitted) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleVote(size) {
    setVotes(prev => ({ ...prev, self: size }));
  }

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    // Majority wins — just use own vote for solo, or pick most common
    const allVotes = Object.values(votes);
    if (!allVotes.length) {
      onEstimate(TSHIRT_MAP.M); // default M
      return;
    }
    const counts = {};
    allVotes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    onEstimate(TSHIRT_MAP[winner] || 5);
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '2px solid var(--epic)',
        borderRadius: 'var(--radius)', padding: 24, maxWidth: 400, width: '90%',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace", marginBottom: 8 }}>QUICK ESTIMATE</p>
        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{item?.title}</p>
        <p style={{
          fontSize: 14, fontWeight: 700, fontFamily: "'Press Start 2P', monospace",
          color: timer <= 5 ? 'var(--danger)' : 'var(--epic)',
          animation: timer <= 5 ? 'gaugePulse 0.5s ease-in-out infinite' : 'none',
          marginBottom: 16,
        }}>⏱ {timer}s</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {Object.entries(TSHIRT_MAP).map(([size, sp]) => (
            <button key={size} onClick={() => handleVote(size)} style={{
              padding: '12px 16px', border: `2px solid ${votes.self === size ? 'var(--epic)' : 'var(--border)'}`,
              background: votes.self === size ? 'var(--epic-dim)' : 'var(--bg3)',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12,
              fontFamily: "'Press Start 2P', monospace", color: 'var(--text)',
            }}>
              <div>{size}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{sp} SP</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={handleSubmit} disabled={!votes.self} style={{
            ...screenStyles.primaryBtn, padding: '10px 20px', fontSize: 10,
            opacity: votes.self ? 1 : 0.5,
          }}>Confirm</button>
          <button onClick={onCancel} style={{ ...screenStyles.secondaryBtn, padding: '10px 20px', fontSize: 10 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── CSS Confetti (pure CSS, no library) ───────────────────────────────────────
function ConfettiBurst({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 30;
    const colors = ['var(--gold)', 'var(--epic)', 'var(--jade)', 'var(--danger)', '#facc15'];
    return { tx, ty, color: colors[i % colors.length], delay: Math.random() * 0.15 };
  });

  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none', zIndex: 10 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 6, height: 6,
          background: p.color, borderRadius: 2,
          '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
          animation: `confettiPop 0.8s ${p.delay}s ease-out forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Sprint Celebration Overlay ────────────────────────────────────────────────
function SprintCelebration({ sprintName, capacityPct, participants, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.92)', zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeOverlay 3.5s ease-in-out forwards',
    }}>
      <div style={{
        fontSize: 20, fontFamily: "'Press Start 2P', monospace",
        color: 'var(--jade)', textShadow: '0 0 30px rgba(0,200,150,0.5)',
        marginBottom: 16, animation: 'bounceIn 0.6s ease-out',
      }}>
        SPRINT LOCKED AND LOADED 🚀
      </div>
      {sprintName && (
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>
          {sprintName} · {capacityPct}% filled
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(participants || []).slice(0, 8).map((p, i) => (
          <div key={p.id || i} style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--epic-dim)',
            border: '2px solid var(--epic)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--text)', fontWeight: 700,
            animation: `bounceIn 0.4s ${0.1 * i}s ease-out both`,
          }}>
            {(p.display_name || 'A')[0].toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Capacity Gauge (enhanced) ─────────────────────────────────────────────────
function CapacityGauge({ used, total, overflowFlash }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 105) : 0;
  const isLocked = pct >= 100;
  const isDanger = pct > 95;
  const isWarning = pct > 80;
  const color = isDanger ? 'var(--danger)' : isWarning ? 'var(--gold)' : 'var(--jade)';
  const pulseSpeed = isDanger ? '0.5s' : isWarning ? '1s' : 'none';
  const [showPerfect, setShowPerfect] = useState(false);

  useEffect(() => {
    if (Math.round(pct) === 100 && !isDanger) {
      setShowPerfect(true);
      const t = setTimeout(() => setShowPerfect(false), 2000);
      return () => clearTimeout(t);
    }
  }, [pct, isDanger]);

  return (
    <div style={{
      ...gaugeStyles.container,
      animation: overflowFlash ? 'overflowShake 0.5s ease-in-out' : 'none',
    }}>
      <div style={gaugeStyles.header}>
        <span style={{ color: 'var(--text2)', fontSize: 11, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          CAPACITY
          {isLocked && <span style={{ animation: 'lockSlam 0.4s ease-out' }}>🔒</span>}
        </span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>
          {Math.round(used)} / {total} SP ({Math.round(pct)}%)
        </span>
      </div>
      <div style={gaugeStyles.track}>
        <div style={{
          ...gaugeStyles.fill,
          width: `${Math.min(pct, 100)}%`,
          background: color,
          animation: isWarning ? `gaugePulse ${pulseSpeed} ease-in-out infinite` : 'none',
        }} />
      </div>
      {showPerfect && (
        <div style={{
          textAlign: 'center', marginTop: 6, fontSize: 10,
          color: 'var(--jade)', fontFamily: "'Press Start 2P', monospace",
          animation: 'perfectFill 2s ease-out forwards',
        }}>
          🎯 Perfect Fill!
        </div>
      )}
      {overflowFlash && (
        <div style={{
          textAlign: 'center', marginTop: 4, fontSize: 10,
          color: 'var(--danger)', fontWeight: 700, fontFamily: "'Press Start 2P', monospace",
        }}>
          OVERFLOW
        </div>
      )}
    </div>
  );
}

const gaugeStyles = {
  container: { marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontFamily: "'Press Start 2P', monospace" },
  track: { height: 14, background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 'var(--radius)', transition: 'width 0.5s ease, background 0.3s ease' },
};

// ── Priority Token Button ─────────────────────────────────────────────────────
function TokenAssigner({ tokens, maxTokens, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => onChange(Math.max(0, tokens - 1))} disabled={tokens <= 0} style={tokenBtnStyle}>−</button>
      <span style={{ color: 'var(--epic)', fontWeight: 700, fontSize: 14, minWidth: 18, textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>{tokens}</span>
      <button onClick={() => onChange(Math.min(maxTokens, tokens + 1))} disabled={tokens >= maxTokens} style={tokenBtnStyle}>+</button>
      {Array.from({ length: tokens }).map((_, i) => (
        <span key={i} style={{ color: 'var(--epic)', fontSize: 12 }}>⭐</span>
      ))}
    </div>
  );
}

const tokenBtnStyle = {
  width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};

// ── Mystery Card ──────────────────────────────────────────────────────────────
function MysteryCard({ item, onFlip }) {
  return (
    <div style={{
      padding: '16px', background: '#1a1a2e', border: '2px solid var(--epic-border)',
      borderRadius: 'var(--radius)', textAlign: 'center', cursor: 'pointer',
      minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 32, color: 'var(--epic)',
        animation: 'mysteryGlow 2s ease-in-out infinite',
        marginBottom: 8,
      }}>?</div>
      <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>
        {item.title}
      </p>
      <button onClick={() => onFlip(item)} style={{
        padding: '6px 14px', background: 'var(--epic-dim)', border: '1px solid var(--epic)',
        borderRadius: 'var(--radius)', color: 'var(--epic)', fontSize: 9,
        fontFamily: "'Press Start 2P', monospace", cursor: 'pointer',
      }}>
        🃏 Flip Card
      </button>
    </div>
  );
}

// ── Draft Item Card (enhanced with mystery + reveal animations) ───────────────
function DraftItemCard({ item, priorityScore, pick, onDraft, onSkip, onPark, capacityLeft, isGM, onOverride, disabled, onFlipMystery, revealAnim }) {
  const estimate = Number(item.final_estimate) || Number(item.estimated_hours) || 0;
  const isMystery = !estimate && !pick;
  const wontFit = estimate > 0 && estimate > capacityLeft && !pick;
  const decision = pick?.decision;

  const borderColor = decision === 'drafted' ? 'var(--jade)' : decision === 'stretch' ? 'var(--gold)' :
    decision === 'skipped' ? 'var(--text3)' : decision === 'parked' ? 'var(--text3)' : 'var(--border)';

  // Reveal animation state
  const isSmall = revealAnim === 'small';
  const isBig = revealAnim === 'big';
  const isFlipping = revealAnim === 'flipping';

  if (isMystery && !pick) {
    return <MysteryCard item={item} onFlip={onFlipMystery} />;
  }

  return (
    <div style={{
      padding: '12px 16px', background: wontFit ? 'rgba(255,255,255,0.03)' : 'var(--bg2)',
      border: `2px solid ${borderColor}`, borderRadius: 'var(--radius)',
      marginBottom: 8, opacity: wontFit ? 0.5 : decision ? 0.85 : 1,
      transition: 'all 0.3s ease',
      animation: isFlipping ? 'cardFlip 0.6s ease-in-out' : isSmall ? 'greenFlash 1.5s ease-out' : isBig ? 'cameraShake 0.8s ease-in-out' : 'none',
      position: 'relative',
    }}>
      {(isSmall || isBig) && (
        <div style={{
          position: 'absolute', top: -8, right: 12, fontSize: 9,
          color: isSmall ? 'var(--jade)' : 'var(--danger)',
          fontFamily: "'Press Start 2P', monospace", fontWeight: 700,
          animation: 'bounceIn 0.4s ease-out',
        }}>
          {isSmall ? 'Nice! Small one!' : "Whoa, that's a big one!"}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {item.item_code && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{item.title}</span>
          </div>
          {priorityScore > 0 && (
            <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>
              ⭐ {priorityScore} priority
            </span>
          )}
        </div>
        <div style={{
          padding: '4px 10px', background: estimate ? 'var(--bg3)' : 'var(--danger)',
          borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 700,
          color: estimate ? 'var(--text)' : '#fff', fontFamily: "'Press Start 2P', monospace",
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {estimate || '?'} SP
          {pick?.estimate_source === 'quick' && (
            <span style={{ fontSize: 8, color: 'var(--warn)' }}>⚠️ rough</span>
          )}
        </div>
      </div>

      {decision && (
        <div style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius)',
          fontSize: 10, fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace",
          background: decision === 'drafted' ? 'rgba(0,200,150,0.15)' : 'rgba(128,128,128,0.15)',
          color: decision === 'drafted' ? 'var(--jade)' : 'var(--text3)',
        }}>
          {decision === 'drafted' ? '✅ DRAFTED' : decision === 'skipped' ? '⏭️ SKIPPED' : decision === 'parked' ? '📦 PARKED' : '🔶 STRETCH'}
          {pick?.pm_override && <span style={{ marginLeft: 6, color: 'var(--gold)' }}>PM OVERRIDE</span>}
        </div>
      )}

      {wontFit && !decision && (
        <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace" }}>
          ⚠️ WON'T FIT
        </div>
      )}

      {!decision && !disabled && !isMystery && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onDraft} disabled={wontFit} style={{ ...actionBtn, background: wontFit ? 'var(--bg3)' : 'rgba(0,200,150,0.15)', color: wontFit ? 'var(--text3)' : 'var(--jade)', borderColor: wontFit ? 'var(--border)' : 'var(--jade)' }}>
            ✅ Draft
          </button>
          <button onClick={onSkip} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>
            ⏭️ Skip
          </button>
          <button onClick={onPark} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>
            📦 Park
          </button>
          {isGM && wontFit && (
            <button onClick={onOverride} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>
              🔓 Override
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtn = {
  padding: '6px 12px', border: '1px solid', background: 'transparent',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SprintDraftScreen({ sessionId, user, onBack }) {
  useEffect(() => { injectDraftStyles(); }, []);
  const { soundEnabled, toggleSound } = useGameSound();
  const [step, setStep] = useState('lobby');
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState({});
  const [priorityScores, setPriorityScores] = useState({});
  const [myTokens, setMyTokens] = useState({});
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(VOTE_TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [confidenceVotes, setConfidenceVotes] = useState({});
  const [myConfidence, setMyConfidence] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [mysteryFlipItem, setMysteryFlipItem] = useState(null);
  const [revealAnims, setRevealAnims] = useState({});
  const [overflowFlash, setOverflowFlash] = useState(false);
  const [consensusItems, setConsensusItems] = useState({});
  const timerRef = useRef(null);
  const pickOrderRef = useRef(0);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [flashClass, setFlashClass] = useState('');
  const perfectFillTriggered = useRef(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1400);
  }
  function triggerShake() { setShaking(true); setTimeout(() => setShaking(false), 500); }
  function triggerFlash(cls) { setFlashClass(cls); setTimeout(() => setFlashClass(''), 700); }

  const isGM = session?.game_master_id === user?.id;
  const capacity = session?.draft_config?.capacity_points || 0;

  const capacityUsed = useMemo(() => {
    return Object.values(picks)
      .filter(p => p.decision === 'drafted' || p.decision === 'stretch')
      .reduce((sum, p) => sum + (Number(p.estimate_at_draft) || 0), 0);
  }, [picks]);

  const capacityLeft = capacity - capacityUsed;
  const capacityPct = capacity > 0 ? Math.round((capacityUsed / capacity) * 100) : 0;

  const tokensUsed = useMemo(() => {
    return Object.values(myTokens).reduce((sum, t) => sum + t, 0);
  }, [myTokens]);

  const tokensRemaining = PRIORITY_TOKENS - tokensUsed;

  // Check consensus on priority votes (>70% of all tokens)
  const totalTokensDistributed = useMemo(() => {
    return Object.values(priorityScores).reduce((sum, s) => sum + s, 0);
  }, [priorityScores]);

  useEffect(() => {
    if (totalTokensDistributed === 0) return;
    const newConsensus = {};
    for (const [itemId, score] of Object.entries(priorityScores)) {
      if (score / totalTokensDistributed > 0.7) {
        newConsensus[itemId] = true;
      }
    }
    setConsensusItems(newConsensus);
  }, [priorityScores, totalTokensDistributed]);

  // Sort items by priority score
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (priorityScores[b.id] || 0) - (priorityScores[a.id] || 0));
  }, [items, priorityScores]);

  // Load draft state
  const loadState = useCallback(async () => {
    try {
      const state = await getDraftState(sessionId);
      setSession(state.session);
      setItems(state.items || []);
      setPriorityScores(state.priorityScores || {});
      const pickMap = {};
      for (const p of (state.picks || [])) {
        pickMap[p.session_item_id] = p;
        if (p.pick_order >= pickOrderRef.current) pickOrderRef.current = p.pick_order + 1;
      }
      setPicks(pickMap);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadState(); }, [loadState]);

  // Load participants
  useEffect(() => {
    if (!sessionId) return;
    fetchRawParticipants(sessionId).then(data => setParticipants(data));
  }, [sessionId]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`draft-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_priority_votes', filter: `session_id=eq.${sessionId}` }, () => { loadState(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_picks', filter: `session_id=eq.${sessionId}` }, () => { loadState(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadState]);

  // Timer for priority vote
  useEffect(() => {
    if (!timerActive) return;
    if (timer <= 0) {
      setTimerActive(false);
      handleEndPriorityVote();
      return;
    }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  function handleStartPriorityVote() {
    setStep('priority');
    setTimer(VOTE_TIMER_SECONDS);
    setTimerActive(true);
  }

  async function handleEndPriorityVote() {
    setTimerActive(false);
    const votes = Object.entries(myTokens)
      .filter(([, t]) => t > 0)
      .map(([session_item_id, tokens]) => ({ session_item_id, tokens }));
    if (votes.length) {
      try {
        const result = await submitPriorityVotes(sessionId, votes);
        setPriorityScores(result.scores || {});
      } catch (e) {
        console.error('Priority vote error:', e);
      }
    }
    setStep('draft');
  }

  function handleTokenChange(itemId, newVal) {
    const currentUsed = tokensUsed - (myTokens[itemId] || 0);
    const maxAllowed = PRIORITY_TOKENS - currentUsed;
    const clamped = Math.max(0, Math.min(newVal, maxAllowed));
    setMyTokens(prev => ({ ...prev, [itemId]: clamped }));
  }

  async function handleDraftDecision(itemId, decision, isOverride = false) {
    const item = items.find(i => i.id === itemId);
    const estimate = Number(item?.final_estimate) || Number(item?.estimated_hours) || 0;

    // Capacity overflow check
    if (decision === 'drafted' && !isOverride && estimate > 0 && estimate > capacityLeft) {
      setOverflowFlash(true);
      setTimeout(() => setOverflowFlash(false), 600);
      // Game soul: overflow warning
      addDmg('⚠️ Over capacity!', C.red);
      triggerShake();
      triggerFlash('sd-flash-red');
      return;
    }

    const order = pickOrderRef.current++;
    const newPick = {
      session_item_id: itemId,
      pick_order: order,
      decision,
      estimate_at_draft: estimate,
      estimate_source: revealAnims[itemId] ? 'quick' : 'existing',
      voted_in: !isOverride,
      pm_override: isOverride,
      priority_score: priorityScores[itemId] || 0,
    };
    setPicks(prev => ({ ...prev, [itemId]: newPick }));
    try {
      await submitDraftPicks(sessionId, [newPick]);
      // Game soul: draft feedback
      if (decision === 'drafted') {
        addDmg('+1 drafted', C.grn);
        playCoin();
      }
    } catch (e) {
      console.error('Draft pick error:', e);
    }
  }

  function handleMysteryFlip(item) {
    setMysteryFlipItem(item);
  }

  function handleQuickEstimate(estimateValue) {
    if (!mysteryFlipItem) return;
    const itemId = mysteryFlipItem.id;
    setMysteryFlipItem(null);

    // Trigger flip animation
    setRevealAnims(prev => ({ ...prev, [itemId]: 'flipping' }));

    setTimeout(() => {
      // Update item with estimate
      setItems(prev => prev.map(it =>
        it.id === itemId ? { ...it, final_estimate: estimateValue, estimated_hours: estimateValue } : it
      ));

      // Suspense pause then reveal reaction
      setTimeout(() => {
        const anim = estimateValue <= 5 ? 'small' : estimateValue >= 13 ? 'big' : null;
        setRevealAnims(prev => ({ ...prev, [itemId]: anim }));

        // Clear animation after display
        setTimeout(() => {
          setRevealAnims(prev => ({ ...prev, [itemId]: null }));
        }, 1500);
      }, 500);
    }, 600);
  }

  function handleGoToSummary() {
    setStep('summary');
  }

  function handleConfidenceVote(vote) {
    setMyConfidence(vote);
    setConfidenceVotes(prev => ({ ...prev, [user?.id]: vote }));
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await finalizeDraft(sessionId);
      // Game soul: completion fanfare
      triggerFlash('sd-flash-green');
      setLootActive(true); setTimeout(() => setLootActive(false), 2000);
      playFanfare();
      // Perfect Fill achievement: exactly 100% capacity
      if (capacityPct >= 98 && capacityPct <= 102 && user?.id && !perfectFillTriggered.current) {
        perfectFillTriggered.current = true;
        supabase.from('achievement_unlocks').insert({
          user_id: user.id,
          achievement_key: 'perfect_fill',
          session_id: sessionId,
          xp_awarded: 50,
        }).then(() => {}).catch(() => {});
      }
      setShowCelebration(true);
    } catch (e) {
      setError(e.message);
      setFinalizing(false);
    }
  }

  // ── Shared game soul overlay ──
  const draftGameSoul = (
    <>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '🎯', label: 'DRAFT', color: C.gld }, { icon: '✅', label: 'DONE', color: C.grn }]} />
      </div>
      {user?.id && <XPBadgeNotifier userId={user.id} />}
      {user?.id && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={user.id} />
        </div>
      )}
    </>
  );

  // ── Render ──
  if (loading) {
    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
        <div style={screenStyles.container}>
          <div style={screenStyles.loading}>Loading Sprint Draft...</div>
        </div>
      </Scene>
    );
  }

  if (error && !showCelebration) {
    return (
      <div style={screenStyles.container}>
        <div style={{ color: 'var(--danger)', padding: 32, textAlign: 'center' }}>
          <p>Error: {error}</p>
          <button onClick={onBack} style={screenStyles.backBtn}>← Back</button>
        </div>
      </div>
    );
  }

  if (showCelebration) {
    return (
      <SprintCelebration
        sprintName={session?.name}
        capacityPct={capacityPct}
        participants={participants}
        onDone={() => { if (onBack) onBack(); }}
      />
    );
  }

  // ── Step 1: Lobby ──
  if (step === 'lobby') {
    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
      <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <button onClick={onBack} style={screenStyles.backBtn}>← Back</button>
          <h1 style={screenStyles.title}>🎯 SPRINT DRAFT</h1>
          <p style={screenStyles.subtitle}>{session?.name}</p>

          <div style={screenStyles.statRow}>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>CAPACITY</span>
              <span style={screenStyles.statValue}>{capacity} SP</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>ITEMS IN POOL</span>
              <span style={screenStyles.statValue}>{items.length}</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>PARTICIPANTS</span>
              <span style={screenStyles.statValue}>{participants.length}</span>
            </div>
          </div>

          <div style={{ margin: '16px 0', padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>JOIN CODE</p>
            <p style={{ fontSize: 18, color: 'var(--epic)', fontWeight: 700, letterSpacing: 4, fontFamily: "'Press Start 2P', monospace" }}>{session?.join_code || '—'}</p>
          </div>

          {participants.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARTICIPANTS</p>
              {/* Sprite avatars for participants */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                {participants.map((p, i) => (
                  <Sprite key={p.id} m={{ name: (p.display_name || 'Anon').split(' ')[0], cls: CLASSES[i % CLASSES.length], lv: 3, hat: CLASSES[i % CLASSES.length].color, body: CLASSES[i % CLASSES.length].color, skin: '#fdd' }} size={1.0} idle />
                ))}
              </div>
              {participants.map(p => (
                <div key={p.id} style={{ padding: '4px 0', fontSize: 12, color: 'var(--text2)' }}>
                  {p.display_name || 'Anonymous'} {p.user_id === session?.game_master_id ? '👑' : ''}
                </div>
              ))}
            </div>
          )}

          {isGM && (
            <button onClick={handleStartPriorityVote} style={screenStyles.primaryBtn}>
              ⭐ Start Priority Vote
            </button>
          )}
          {!isGM && (
            <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
              Waiting for GM to start...
            </p>
          )}
        </div>
      </div>
      </Scene>
    );
  }

  // ── Step 2: Priority Vote ──
  if (step === 'priority') {
    const timerPct = (timer / VOTE_TIMER_SECONDS) * 100;

    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
      <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>⭐ PRIORITY VOTE</h2>
          <p style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', marginBottom: 12 }}>
            Distribute {PRIORITY_TOKENS} tokens across items you think are most important
          </p>

          {/* Timer */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: timer <= 10 ? 'var(--danger)' : 'var(--text3)', marginBottom: 4, fontFamily: "'Press Start 2P', monospace" }}>
              <span>⏱ {timer}s</span>
              <span>Tokens: {tokensRemaining} left</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${timerPct}%`,
                background: timer <= 10 ? 'var(--danger)' : 'var(--epic)',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>

          {/* Items grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {items.map(item => {
              const score = priorityScores[item.id] || 0;
              const isConsensus = consensusItems[item.id];

              return (
                <div key={item.id} style={{
                  padding: '12px', background: 'var(--bg2)',
                  border: isConsensus ? '2px solid var(--gold)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                  animation: isConsensus ? 'consensusGlow 2s ease-in-out' : 'none',
                }}>
                  {isConsensus && <ConfettiBurst active />}
                  {isConsensus && (
                    <div style={{
                      position: 'absolute', top: 4, right: 8, fontSize: 8,
                      color: 'var(--gold)', fontFamily: "'Press Start 2P', monospace", fontWeight: 700,
                    }}>
                      🔥 HIGH PRIORITY
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.item_code && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
                      <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: '2px 0 0' }}>{item.title}</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace", marginLeft: 8 }}>
                      {Number(item.final_estimate) || '?'} SP
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TokenAssigner
                      tokens={myTokens[item.id] || 0}
                      maxTokens={tokensRemaining + (myTokens[item.id] || 0)}
                      onChange={(val) => handleTokenChange(item.id, val)}
                    />
                    {score > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>
                        🔥 {score}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isGM && (
            <button onClick={handleEndPriorityVote} style={{ ...screenStyles.primaryBtn, marginTop: 16, background: 'var(--gold)', color: '#000' }}>
              End Vote Early →
            </button>
          )}
        </div>
      </div>
      </Scene>
    );
  }

  // ── Step 3: The Draft ──
  if (step === 'draft') {
    const allDecided = sortedItems.every(item => picks[item.id]);

    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
      <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>🎯 THE DRAFT</h2>

          <CapacityGauge used={capacityUsed} total={capacity} overflowFlash={overflowFlash} />

          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {sortedItems.map(item => (
              <DraftItemCard
                key={item.id}
                item={item}
                priorityScore={priorityScores[item.id] || 0}
                pick={picks[item.id]}
                capacityLeft={capacityLeft}
                isGM={isGM}
                disabled={false}
                revealAnim={revealAnims[item.id]}
                onDraft={() => handleDraftDecision(item.id, 'drafted')}
                onSkip={() => handleDraftDecision(item.id, 'skipped')}
                onPark={() => handleDraftDecision(item.id, 'parked')}
                onOverride={() => handleDraftDecision(item.id, 'drafted', true)}
                onFlipMystery={() => handleMysteryFlip(item)}
              />
            ))}
          </div>

          {allDecided && (
            <button onClick={handleGoToSummary} style={{ ...screenStyles.primaryBtn, marginTop: 16 }}>
              Review Summary →
            </button>
          )}
          {!allDecided && isGM && (
            <button onClick={handleGoToSummary} style={{ ...screenStyles.secondaryBtn, marginTop: 16 }}>
              Skip to Summary →
            </button>
          )}
        </div>

        {/* Quick Estimate Modal */}
        {mysteryFlipItem && (
          <QuickEstimateModal
            item={mysteryFlipItem}
            onEstimate={handleQuickEstimate}
            onCancel={() => setMysteryFlipItem(null)}
          />
        )}
      </div>
      </Scene>
    );
  }

  // ── Step 4: Summary + Confidence Vote ──
  if (step === 'summary') {
    const draftedItems = sortedItems.filter(item => {
      const p = picks[item.id];
      return p && (p.decision === 'drafted' || p.decision === 'stretch');
    });
    const stretchItems = draftedItems.filter(item => picks[item.id]?.decision === 'stretch');
    const skippedItems = sortedItems.filter(item => picks[item.id]?.decision === 'skipped');
    const parkedItems = sortedItems.filter(item => picks[item.id]?.decision === 'parked');

    const totalSP = draftedItems.reduce((sum, item) => sum + (Number(item.final_estimate) || Number(item.estimated_hours) || 0), 0);
    const pct = capacity > 0 ? Math.round((totalSP / capacity) * 100) : 0;

    const confidenceEntries = Object.values(confidenceVotes);
    const thumbsUp = confidenceEntries.filter(v => v === 'up').length;
    const confidencePct = confidenceEntries.length > 0 ? Math.round((thumbsUp / confidenceEntries.length) * 100) : 0;

    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
      <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>📋 SPRINT SUMMARY</h2>

          <CapacityGauge used={totalSP} total={capacity} />

          <div style={screenStyles.statRow}>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>DRAFTED</span>
              <span style={{ ...screenStyles.statValue, color: 'var(--jade)' }}>{draftedItems.length} items</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>TOTAL SP</span>
              <span style={screenStyles.statValue}>{totalSP} SP ({pct}%)</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>SKIPPED</span>
              <span style={{ ...screenStyles.statValue, color: 'var(--text3)' }}>{skippedItems.length}</span>
            </div>
          </div>

          {/* Drafted items list */}
          <div style={{ margin: '16px 0' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>DRAFTED ITEMS</p>
            {draftedItems.map(item => (
              <div key={item.id} style={{
                padding: '8px 12px', marginBottom: 4,
                background: picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.08)' : 'rgba(0,200,150,0.08)',
                border: `1px solid ${picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.25)' : 'rgba(0,200,150,0.25)'}`,
                borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{item.item_code ? `${item.item_code} — ` : ''}{item.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace" }}>
                  {Number(item.final_estimate) || Number(item.estimated_hours) || '?'} SP
                </span>
              </div>
            ))}
            {stretchItems.length > 0 && (
              <p style={{ fontSize: 9, color: 'var(--gold)', marginTop: 4, fontFamily: "'Press Start 2P', monospace" }}>
                {stretchItems.length} stretch goal{stretchItems.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {parkedItems.length > 0 && (
            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARKED</p>
              {parkedItems.map(item => (
                <div key={item.id} style={{
                  padding: '6px 12px', marginBottom: 3, background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  fontSize: 12, color: 'var(--text3)',
                }}>
                  {item.title}
                </div>
              ))}
            </div>
          )}

          {/* Confidence Vote */}
          <div style={{ margin: '20px 0', padding: '16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, fontFamily: "'Press Start 2P', monospace" }}>CONFIDENCE VOTE</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <button onClick={() => handleConfidenceVote('up')} style={{
                ...confBtn, borderColor: myConfidence === 'up' ? 'var(--jade)' : 'var(--border)',
                background: myConfidence === 'up' ? 'rgba(0,200,150,0.15)' : 'transparent',
              }}>👍</button>
              <button onClick={() => handleConfidenceVote('down')} style={{
                ...confBtn, borderColor: myConfidence === 'down' ? 'var(--danger)' : 'var(--border)',
                background: myConfidence === 'down' ? 'rgba(255,80,80,0.15)' : 'transparent',
              }}>👎</button>
            </div>
            {confidenceEntries.length > 0 && (
              <p style={{
                fontSize: 12, fontWeight: 700, fontFamily: "'Press Start 2P', monospace",
                color: confidencePct >= 75 ? 'var(--jade)' : confidencePct >= 50 ? 'var(--gold)' : 'var(--danger)',
              }}>
                Team confidence: {confidencePct}%
              </p>
            )}
          </div>

          {/* Finalize */}
          {isGM && (
            <button onClick={handleFinalize} disabled={finalizing} style={{
              ...screenStyles.primaryBtn,
              background: finalizing ? 'var(--bg3)' : 'linear-gradient(135deg, var(--jade), #059669)',
              opacity: finalizing ? 0.6 : 1,
            }}>
              {finalizing ? '⏳ Finalizing...' : '🚀 Finalize Sprint'}
            </button>
          )}

          <button onClick={() => setStep('draft')} style={{ ...screenStyles.secondaryBtn, marginTop: 8 }}>
            ← Back to Draft
          </button>
        </div>
      </div>
      </Scene>
    );
  }

  return null;
}

const confBtn = {
  width: 56, height: 56, fontSize: 24, border: '2px solid',
  borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer',
};

const screenStyles = {
  container: {
    minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace", padding: '24px 16px',
  },
  panel: {
    width: '100%', maxWidth: 800, padding: '24px',
    background: 'rgba(14, 16, 25, 0.95)', border: '2px solid var(--epic)',
    boxShadow: '0 0 30px rgba(124,58,237,0.2)', borderRadius: 'var(--radius)',
  },
  title: {
    margin: '0 0 8px', fontSize: 16, color: 'var(--epic)', textAlign: 'center',
    textShadow: '0 0 10px rgba(167,139,250,0.5)', letterSpacing: 2,
  },
  subtitle: {
    margin: '0 0 20px', fontSize: 10, color: 'var(--text2)', textAlign: 'center', letterSpacing: 1,
  },
  statRow: {
    display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
  },
  stat: {
    flex: 1, minWidth: 100, padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', textAlign: 'center',
  },
  statLabel: {
    display: 'block', fontSize: 8, color: 'var(--text3)', marginBottom: 4, letterSpacing: 1,
  },
  statValue: {
    display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 700,
  },
  primaryBtn: {
    width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, var(--epic), #4f46e5)',
    border: '2px solid var(--epic)', color: '#fff', fontSize: 10, cursor: 'pointer', letterSpacing: 1,
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  secondaryBtn: {
    width: '100%', padding: '10px 16px', background: 'transparent',
    border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 9, cursor: 'pointer',
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
    fontSize: 10, fontFamily: "'Press Start 2P', monospace", marginBottom: 16,
  },
  loading: {
    color: 'var(--text2)', padding: 48, textAlign: 'center', fontSize: 12,
  },
};
