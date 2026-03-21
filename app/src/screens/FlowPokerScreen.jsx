/**
 * Flow Poker — Kanban cycle time estimation
 *
 * Instead of story points, teams estimate cycle time in days.
 * Reveal: histogram + median + Flow Health Score.
 * Write-back: cycle_time_estimate on session_items (GM approval required).
 *
 * Flow:
 *   lobby → voting (per item) → reveal (histogram) → next item → summary
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sprite, Scene, DmgNum } from '../components/session/SessionPrimitives.jsx';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const DAYS = [1, 2, 3, 5, 8, 13, 21];

// ─── Style injection ────────────────────────────────────────────────────────
let fpStylesInjected = false;
function injectFPStyles() {
  if (fpStylesInjected) return;
  fpStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes fp-wave {
      0%,100%{transform:scaleY(1)}
      50%{transform:scaleY(1.4)}
    }
    @keyframes fp-bar-grow {
      from{height:0}
      to{height:var(--bar-h)}
    }
    @keyframes fp-reveal-in {
      0%{opacity:0;transform:translateY(20px)}
      100%{opacity:1;transform:translateY(0)}
    }
    @keyframes fp-blocker-pulse {
      0%,100%{box-shadow:0 0 8px #ef4444,0 0 16px #ef4444}
      50%{box-shadow:0 0 24px #ef4444,0 0 48px #ef4444}
    }
    @keyframes fp-card-select {
      0%{transform:scale(1)}
      50%{transform:scale(1.12)}
      100%{transform:scale(1.05)}
    }
    @keyframes fp-score-pop {
      0%{transform:scale(0);opacity:0}
      60%{transform:scale(1.2);opacity:1}
      100%{transform:scale(1);opacity:1}
    }
    @keyframes fp-flow-arrow {
      0%{transform:translateX(0);opacity:0.6}
      100%{transform:translateX(40px);opacity:0.2}
    }
    @keyframes fp-scanline {
      0%{background-position:0 0}
      100%{background-position:0 4px}
    }
    .fp-card-selected { animation: fp-card-select 0.3s ease forwards; }
    .fp-reveal-in     { animation: fp-reveal-in 0.4s ease-out forwards; }
    .fp-score-pop     { animation: fp-score-pop 0.5s ease-out forwards; }
    .fp-blocker       { animation: fp-blocker-pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── Audio ──────────────────────────────────────────────────────────────────
function playTone(freq, type = 'square', duration = 0.2, gain = 0.12) {
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
  } catch {}
}

function playCardPick() { playTone(660, 'square', 0.12, 0.1); }
function playReveal()   { playTone(440, 'triangle', 0.3, 0.15); setTimeout(() => playTone(554, 'triangle', 0.3, 0.15), 150); }
function playBlocker()  { playTone(110, 'sawtooth', 0.6, 0.2); }
function playWrite()    { playTone(880, 'square', 0.1, 0.1); }
function playComplete() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2, 0.12), i * 100));
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function flowHealthScore(estimates) {
  if (!estimates.length) return { score: 0, label: 'N/A', color: '#6b7280' };
  const sd = stdDev(estimates);
  // Low spread = good (100), high spread = bad (0)
  if (sd <= 1) return { score: 100, label: 'EXCELLENT', color: '#22c55e' };
  if (sd <= 2) return { score: 80, label: 'GOOD', color: '#84cc16' };
  if (sd <= 4) return { score: 55, label: 'MODERATE', color: '#f59e0b' };
  if (sd <= 7) return { score: 30, label: 'POOR', color: '#ef4444' };
  return { score: 10, label: 'CHAOTIC', color: '#7f1d1d' };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DayCard({ day, selected, onSelect, disabled }) {
  return (
    <button
      className={selected ? 'fp-card-selected' : ''}
      disabled={disabled}
      onClick={() => { if (!disabled) { playCardPick(); onSelect(day); } }}
      style={{
        fontFamily: PF,
        fontSize: '14px',
        color: selected ? '#0e1019' : '#a0aec0',
        background: selected
          ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
          : 'rgba(255,255,255,0.04)',
        border: selected ? '2px solid #38bdf8' : '2px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        padding: '12px 16px',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: '60px',
        transition: 'border-color 0.15s, background 0.15s, color 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }} />
      )}
      {day}
      <div style={{ fontFamily: VT, fontSize: '10px', marginTop: 4, opacity: 0.7 }}>
        {day === 1 ? 'day' : 'days'}
      </div>
    </button>
  );
}

function Histogram({ estimates, medianVal }) {
  const counts = DAYS.map(d => estimates.filter(e => e === d).length);
  const max = Math.max(...counts, 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 8px' }}>
      {DAYS.map((d, i) => {
        const h = Math.round((counts[i] / max) * 100);
        const isMedian = d === medianVal || (d < medianVal && DAYS[i + 1] > medianVal);
        const isBlocker = d > 5;
        return (
          <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {counts[i] > 0 && (
              <div style={{ fontFamily: VT, fontSize: 14, color: '#94a3b8' }}>{counts[i]}</div>
            )}
            <div
              className="fp-reveal-in"
              style={{
                width: '100%',
                height: `${h}%`,
                minHeight: counts[i] > 0 ? 8 : 0,
                background: isBlocker
                  ? 'linear-gradient(180deg, #ef4444 0%, #991b1b 100%)'
                  : isMedian
                    ? 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)'
                    : 'linear-gradient(180deg, #0ea5e9 0%, #075985 100%)',
                borderRadius: '2px 2px 0 0',
                transition: 'height 0.5s ease',
                animation: `fp-bar-grow 0.5s ease-out`,
                border: isMedian ? '1px solid #7dd3fc' : '1px solid rgba(56,189,248,0.3)',
              }}
            />
            <div style={{ fontFamily: PF, fontSize: 7, color: isBlocker ? '#ef4444' : '#64748b' }}>{d}</div>
          </div>
        );
      })}
    </div>
  );
}

function RiskMatrix2x2({ risks }) {
  // Not used in FlowPoker — placeholder for RiskPoker
  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function FlowPokerScreen({ sessionId, user, onBack }) {
  injectFPStyles();
  const [phase, setPhase] = useState('loading'); // loading | lobby | voting | reveal | summary
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [myVotes, setMyVotes] = useState({}); // itemId → days
  const [allVotes, setAllVotes] = useState({}); // itemId → [{user_id, days}]
  const [revealedItems, setRevealedItems] = useState(new Set());
  const [approvedItems, setApprovedItems] = useState(new Set());
  const [dmgNums, setDmgNums] = useState([]);
  const [bossHp, setBossHp] = useState(100);
  const [showSummary, setShowSummary] = useState(false);
  const [isGm, setIsGm] = useState(false);
  const [participants, setParticipants] = useState([]);
  const dmgId = useRef(0);
  const { playSound } = useGameSound();

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId]); // eslint-disable-line

  async function loadSession() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (!sess) { setPhase('error'); return; }
    setSession(sess);
    setIsGm(sess.created_by === user?.id);

    const { data: its } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at');
    setItems(its || []);

    // Load existing votes
    const { data: votes } = await supabase
      .from('flow_poker_estimates')
      .select('*')
      .eq('session_id', sessionId);

    const grouped = {};
    const myV = {};
    (votes || []).forEach(v => {
      if (!grouped[v.item_id]) grouped[v.item_id] = [];
      grouped[v.item_id].push(v);
      if (v.user_id === user?.id) myV[v.item_id] = v.days;
    });
    setAllVotes(grouped);
    setMyVotes(myV);
    setPhase('lobby');
  }

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`flow_poker_${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'flow_poker_estimates',
        filter: `session_id=eq.${sessionId}`,
      }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const v = payload.new;
          setAllVotes(prev => {
            const cur = prev[v.item_id] || [];
            const existing = cur.findIndex(x => x.user_id === v.user_id);
            if (existing >= 0) {
              const upd = [...cur]; upd[existing] = v; return { ...prev, [v.item_id]: upd };
            }
            return { ...prev, [v.item_id]: [...cur, v] };
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  // ── Submit vote ───────────────────────────────────────────────────────────
  async function submitVote(itemId, days) {
    setMyVotes(prev => ({ ...prev, [itemId]: days }));
    playCardPick();
    const { error } = await supabase
      .from('flow_poker_estimates')
      .upsert({
        session_id: sessionId,
        item_id: itemId,
        user_id: user.id,
        days,
      }, { onConflict: 'session_id,item_id,user_id' });
    if (error) console.error('vote error', error);
  }

  // ── Reveal item ────────────────────────────────────────────────────────────
  function revealItem(itemId) {
    playReveal();
    setRevealedItems(prev => new Set([...prev, itemId]));
    const estimates = (allVotes[itemId] || []).map(v => v.days);
    const med = median(estimates);
    if (med >= 8) {
      playBlocker();
      spawnDmg('⚠️ FLOW BLOCKER!', '#ef4444', 300);
      setBossHp(hp => Math.max(0, hp - 20));
    } else {
      spawnDmg(`MEDIAN: ${med}d`, '#38bdf8', 200);
      setBossHp(hp => Math.max(0, hp - 5));
    }
  }

  // ── Approve write-back ─────────────────────────────────────────────────────
  async function approveWriteback(itemId) {
    if (!isGm) return;
    const estimates = (allVotes[itemId] || []).map(v => v.days);
    const med = median(estimates);
    const { error } = await supabase
      .from('session_items')
      .update({ cycle_time_estimate: Math.round(med) })
      .eq('id', itemId);
    if (!error) {
      setApprovedItems(prev => new Set([...prev, itemId]));
      playWrite();
      spawnDmg('✓ SAVED', '#22c55e', 150);
    }
  }

  // ── Damage numbers ────────────────────────────────────────────────────────
  function spawnDmg(text, color, x) {
    const id = ++dmgId.current;
    const y = 200 + Math.random() * 60;
    setDmgNums(prev => [...prev, { id, text, color, x, y }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1500);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const currentItem = items[currentItemIdx];
  const currentVotes = currentItem ? (allVotes[currentItem.id] || []).map(v => v.days) : [];
  const currentMedian = median(currentVotes);
  const currentHealth = flowHealthScore(currentVotes);
  const isRevealed = currentItem ? revealedItems.has(currentItem.id) : false;
  const myVoteForCurrent = currentItem ? myVotes[currentItem.id] : null;

  // Overall session flow health
  const allEstimates = items.flatMap(it => (allVotes[it.id] || []).map(v => v.days));
  const sessionHealth = flowHealthScore(allEstimates);
  const blockerItems = items.filter(it => {
    const med = median((allVotes[it.id] || []).map(v => v.days));
    return med >= 8 && revealedItems.has(it.id);
  });

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0e1019', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: PF, color: '#38bdf8' }}>
        LOADING FLOW POKER...
      </div>
    );
  }

  if (showSummary) {
    return (
      <PostSessionSummary
        sessionId={sessionId}
        userId={user?.id}
        onBack={onBack}
      />
    );
  }

  const C = { bg: '#050c14', panel: '#0a1628', text: '#e2e8f0', text2: '#94a3b8', teal: '#0ea5e9', red: '#ef4444', green: '#22c55e' };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: PF, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.12) 3px,rgba(0,0,0,0.12) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Flow arrows background */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'fixed',
          left: `${i * 16}%`,
          top: '50%',
          color: 'rgba(14,165,233,0.06)',
          fontSize: '32px',
          animation: `fp-flow-arrow 3s ease-in-out infinite`,
          animationDelay: `${i * 0.5}s`,
          pointerEvents: 'none',
          zIndex: 0,
        }}>→</div>
      ))}

      {/* Damage numbers */}
      {dmgNums.map(d => (
        <DmgNum key={d.id} text={d.text} color={d.color} x={d.x} y={d.y} />
      ))}

      {/* XP + Sound */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <SoundToggle />
        <GameXPBar userId={user?.id} organizationId={session?.organization_id} />
      </div>
      {user && <XPBadgeNotifier userId={user.id} organizationId={session?.organization_id} />}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 9, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
            ← BACK
          </button>
          <div>
            <div style={{ fontSize: 16, color: C.teal, letterSpacing: 2 }}>🌊 FLOW POKER</div>
            <div style={{ fontSize: 9, color: C.text2, marginTop: 4 }}>{session?.title || 'Session'}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.text2 }}>ITEM {currentItemIdx + 1}/{items.length}</div>
            <div style={{ fontSize: 9, color: sessionHealth.color, marginTop: 2 }}>
              FLOW HEALTH: {sessionHealth.label}
            </div>
          </div>
        </div>

        {/* Boss HP bar (Flow Blocker boss) */}
        {bossHp < 100 && (
          <div style={{ marginBottom: 16, background: C.panel, borderRadius: 4, padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: 8, color: '#ef4444', marginBottom: 6 }}>⚠ THE FLOW BLOCKER — HP: {bossHp}/100</div>
            <div style={{ height: 8, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${bossHp}%`, background: 'linear-gradient(90deg, #ef4444, #dc2626)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Item navigation */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {items.map((it, i) => {
            const hasVotes = (allVotes[it.id] || []).length > 0;
            const revealed = revealedItems.has(it.id);
            const approved = approvedItems.has(it.id);
            const med = median((allVotes[it.id] || []).map(v => v.days));
            const blocker = revealed && med >= 8;
            return (
              <button key={it.id} onClick={() => setCurrentItemIdx(i)} style={{
                fontFamily: VT,
                fontSize: 14,
                color: i === currentItemIdx ? '#0e1019' : approved ? '#22c55e' : blocker ? '#ef4444' : hasVotes ? C.teal : C.text2,
                background: i === currentItemIdx ? C.teal : 'rgba(255,255,255,0.04)',
                border: `1px solid ${i === currentItemIdx ? C.teal : approved ? '#22c55e' : blocker ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {i + 1}
                {approved && ' ✓'}
                {blocker && !approved && ' ⚠'}
              </button>
            );
          })}
        </div>

        {/* Current item */}
        {currentItem && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Left: Item + voting */}
            <div>
              <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(14,165,233,0.2)', marginBottom: 16 }}>
                <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>CURRENT ITEM</div>
                <div style={{ fontFamily: VT, fontSize: 22, color: C.text, marginBottom: 8 }}>{currentItem.title}</div>
                {currentItem.description && (
                  <div style={{ fontFamily: VT, fontSize: 14, color: C.text2 }}>{currentItem.description}</div>
                )}
                {currentItem.cycle_time_estimate && (
                  <div style={{ marginTop: 8, fontSize: 8, color: '#22c55e' }}>
                    LAST ESTIMATE: {currentItem.cycle_time_estimate}d
                  </div>
                )}
              </div>

              {/* Day cards */}
              <div style={{ marginBottom: 12, fontSize: 8, color: C.text2 }}>ESTIMATE CYCLE TIME (DAYS)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {DAYS.map(d => (
                  <DayCard
                    key={d}
                    day={d}
                    selected={myVoteForCurrent === d}
                    onSelect={days => submitVote(currentItem.id, days)}
                    disabled={isRevealed}
                  />
                ))}
              </div>

              {/* Votes cast indicator */}
              <div style={{ fontSize: 8, color: C.text2, marginBottom: 12 }}>
                VOTES CAST: {(allVotes[currentItem.id] || []).length} / {participants.length || '?'}
              </div>

              {/* GM controls */}
              {isGm && !isRevealed && (
                <button
                  onClick={() => revealItem(currentItem.id)}
                  disabled={(allVotes[currentItem.id] || []).length === 0}
                  style={{
                    fontFamily: PF, fontSize: 9,
                    color: '#0e1019', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer',
                    width: '100%', marginBottom: 8,
                    opacity: (allVotes[currentItem.id] || []).length === 0 ? 0.4 : 1,
                  }}
                >
                  🌊 REVEAL FLOW
                </button>
              )}

              {isGm && isRevealed && !approvedItems.has(currentItem.id) && (
                <button
                  onClick={() => approveWriteback(currentItem.id)}
                  style={{
                    fontFamily: PF, fontSize: 8,
                    color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer',
                    width: '100%', marginBottom: 8,
                  }}
                >
                  ✓ APPROVE & SAVE
                </button>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 8 }}>
                {currentItemIdx > 0 && (
                  <button onClick={() => setCurrentItemIdx(i => i - 1)} style={{ fontFamily: PF, fontSize: 8, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>
                    ← PREV
                  </button>
                )}
                {currentItemIdx < items.length - 1 ? (
                  <button onClick={() => setCurrentItemIdx(i => i + 1)} style={{ fontFamily: PF, fontSize: 8, color: C.teal, background: 'none', border: `1px solid ${C.teal}`, borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>
                    NEXT →
                  </button>
                ) : (
                  <button onClick={() => { playComplete(); setShowSummary(true); }} style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>
                    FINISH ✓
                  </button>
                )}
              </div>
            </div>

            {/* Right: Reveal + histogram */}
            <div>
              {!isRevealed ? (
                <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(255,255,255,0.08)', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: 12, opacity: 0.4 }}>🌊</div>
                  <div style={{ fontSize: 9, color: C.text2, textAlign: 'center' }}>
                    WAITING FOR REVEAL...
                  </div>
                  <div style={{ fontSize: 8, color: C.text2, marginTop: 8, textAlign: 'center', opacity: 0.6 }}>
                    {(allVotes[currentItem.id] || []).length} votes submitted
                  </div>
                </div>
              ) : (
                <div className="fp-reveal-in" style={{ background: C.panel, borderRadius: 6, padding: 20, border: `1px solid ${currentMedian >= 8 ? '#ef4444' : 'rgba(14,165,233,0.4)'}` }}>
                  {/* Median */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>MEDIAN CYCLE TIME</div>
                    <div className={`fp-score-pop ${currentMedian >= 8 ? 'fp-blocker' : ''}`} style={{
                      fontSize: 48,
                      color: currentMedian >= 8 ? '#ef4444' : C.teal,
                      fontFamily: PF,
                    }}>
                      {currentMedian}
                      <span style={{ fontSize: 16, color: C.text2, marginLeft: 4 }}>days</span>
                    </div>
                    {currentMedian >= 8 && (
                      <div style={{ fontSize: 9, color: '#ef4444', marginTop: 4 }}>
                        ⚠ FLOW BLOCKER DETECTED
                      </div>
                    )}
                    {currentMedian > 5 && currentMedian < 8 && (
                      <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>
                        ⚠ ELEVATED CYCLE TIME
                      </div>
                    )}
                  </div>

                  {/* Histogram */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>DISTRIBUTION</div>
                    <Histogram estimates={currentVotes} medianVal={currentMedian} />
                  </div>

                  {/* Flow Health Score */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '10px 12px', border: `1px solid ${currentHealth.color}40` }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 6 }}>FLOW HEALTH SCORE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 28, color: currentHealth.color, fontFamily: PF }}>{currentHealth.score}</div>
                      <div>
                        <div style={{ fontSize: 10, color: currentHealth.color }}>{currentHealth.label}</div>
                        <div style={{ fontSize: 8, color: C.text2, marginTop: 2 }}>
                          spread: ±{stdDev(currentVotes).toFixed(1)} days
                        </div>
                      </div>
                    </div>
                    {currentHealth.score < 55 && (
                      <div style={{ marginTop: 8, fontSize: 8, color: '#f59e0b', fontFamily: VT }}>
                        High spread → team has different flow understanding. Discuss!
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  {currentMedian > 5 && (
                    <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <div style={{ fontSize: 8, color: '#ef4444', marginBottom: 4 }}>RECOMMENDATION</div>
                      <div style={{ fontFamily: VT, fontSize: 14, color: '#fca5a5' }}>
                        Items with &gt;5 day cycle time are flow blockers. Consider splitting, removing blockers, or limiting WIP.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom: Blocker summary */}
        {blockerItems.length > 0 && (
          <div style={{ marginTop: 24, background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 16, border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: 9, color: '#ef4444', marginBottom: 12 }}>
              ⚠ FLOW BLOCKERS ({blockerItems.length})
            </div>
            {blockerItems.map(it => {
              const med = median((allVotes[it.id] || []).map(v => v.days));
              return (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontFamily: VT, fontSize: 16, color: C.text }}>{it.title}</div>
                  <div style={{ fontSize: 8, color: '#ef4444' }}>{med} days</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Session Flow Health Summary */}
        {allEstimates.length > 0 && (
          <div style={{ marginTop: 16, background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(14,165,233,0.15)' }}>
            <div style={{ fontSize: 9, color: C.text2, marginBottom: 8 }}>SESSION SUMMARY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: C.teal, fontFamily: PF }}>{median(allEstimates)}</div>
                <div style={{ fontSize: 8, color: C.text2, marginTop: 4 }}>median days</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: sessionHealth.color, fontFamily: PF }}>{sessionHealth.score}</div>
                <div style={{ fontSize: 8, color: C.text2, marginTop: 4 }}>flow health</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: '#ef4444', fontFamily: PF }}>{blockerItems.length}</div>
                <div style={{ fontSize: 8, color: C.text2, marginTop: 4 }}>blockers</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
