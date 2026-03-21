import { handleSoftError } from "../lib/errorHandler";

/**
 * Refinement Roulette — Backlog grooming session for Scrum
 * session_type: refinement_roulette
 *
 * Flow:
 *   lobby → spin → silent_read → dod_write → dod_reveal → clarification → groomed
 *
 * DNA:
 *  - Alle stemmer tæller — ingen kan sidde stille
 *  - PM-data er source of truth — game er advisory
 *  - Gør usikkerhed synlig (misalignment score)
 *  - Feedback loop over tid (HistoricalContext + PostSessionSummary)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchRawParticipants, fetchSessionWithItems } from '../lib/sessionHelpers.js';
import { DmgNum, Scene } from '../components/session/SessionPrimitives.jsx';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

const SILENT_READ_DURATION = 60;   // sek
const DOD_WRITE_DURATION   = 120;  // 2 min

// ─── Style injection ─────────────────────────────────────────────────────────
let rrStylesInjected = false;
function injectRRStyles() {
  if (rrStylesInjected) return;
  rrStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes rr-wheel-spin {
      0%   { transform: rotate(0deg); }
      70%  { transform: rotate(1440deg); }
      85%  { transform: rotate(1530deg); }
      93%  { transform: rotate(1555deg); }
      100% { transform: rotate(1560deg); }
    }
    @keyframes rr-wheel-idle {
      0%,100% { transform: rotate(0deg); }
      50%     { transform: rotate(15deg); }
    }
    @keyframes rr-reveal-pop {
      0%   { opacity:0; transform: scale(0.5) translateY(30px); }
      70%  { transform: scale(1.08) translateY(-6px); }
      100% { opacity:1; transform: scale(1) translateY(0); }
    }
    @keyframes rr-boss-growl {
      0%,100% { transform: scale(1) translateY(0); filter: brightness(1); }
      50%     { transform: scale(1.08) translateY(-6px); filter: brightness(1.4); }
    }
    @keyframes rr-boss-shake {
      0%,100% { transform: translateX(0); }
      25%     { transform: translateX(-8px); }
      75%     { transform: translateX(8px); }
    }
    @keyframes rr-timer-pulse {
      0%,100% { color: #ef4444; transform: scale(1); }
      50%     { color: #fca5a5; transform: scale(1.2); }
    }
    @keyframes rr-misalign-flash {
      0%,100% { opacity: 1; }
      50%     { opacity: 0.4; }
    }
    @keyframes rr-xp-pop {
      0%   { opacity:0; transform: translateY(0); }
      30%  { opacity:1; transform: translateY(-20px); }
      100% { opacity:0; transform: translateY(-60px); }
    }
    @keyframes rr-groomed-bounce {
      0%   { transform: scale(0); }
      60%  { transform: scale(1.2); }
      80%  { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    @keyframes rr-screen-shake {
      0%,100% { transform: translate(0,0); }
      20%     { transform: translate(-4px, 2px); }
      40%     { transform: translate(4px, -2px); }
      60%     { transform: translate(-2px, 4px); }
      80%     { transform: translate(2px, -4px); }
    }
    .rr-shake       { animation: rr-screen-shake 0.5s ease-in-out; }
    .rr-boss-growl  { animation: rr-boss-growl 1.5s ease-in-out infinite; }
    .rr-boss-shake  { animation: rr-boss-shake 0.4s ease-in-out 3; }
    .rr-reveal-pop  { animation: rr-reveal-pop 0.6s ease-out forwards; }
    .rr-groomed     { animation: rr-groomed-bounce 0.5s ease-out forwards; }
  `;
  document.head.appendChild(s);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
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
  } catch (e) { handleSoftError(e, 'audio-init'); }
}

function playSpinSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 12; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 200 + Math.random() * 300;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t); osc.stop(t + 0.07);
    }
    setTimeout(() => ctx.close(), 1200);
  } catch (e) { handleSoftError(e, 'audio-init'); }
}

function playDingReveal() {
  [880, 1100, 1320].forEach((f, i) =>
    setTimeout(() => playTone(f, 'triangle', 0.4, 0.14), i * 120)
  );
}

function playBossGrowl() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.2);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(); osc.stop(ctx.currentTime + 1.5);
    setTimeout(() => ctx.close(), 1800);
  } catch (e) { handleSoftError(e, 'audio-init'); }
}

function playVotePick() { playTone(550, 'square', 0.1, 0.08); }
function playApprove()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2, 0.12), i * 80)); }
function playTimerEnd() { [330, 220, 180].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.3, 0.14), i * 100)); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function computeMisalignment(submissions) {
  if (submissions.length < 2) return 0;
  // Count words across all submissions
  const allWords = submissions.flatMap(s => s.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const wordCounts = {};
  allWords.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
  // Words that only appear once = unique / misaligned
  const uniqueWords = Object.values(wordCounts).filter(c => c === 1).length;
  const totalWords = allWords.length;
  if (!totalWords) return 0;
  return Math.round((uniqueWords / totalWords) * 100);
}

function getUniqueWords(text, allTexts) {
  const allWords = allTexts
    .join(' ')
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3);
  const wordCounts = {};
  allWords.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
  return new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && wordCounts[w] === 1));
}

// ─── RouletteWheel ────────────────────────────────────────────────────────────
function RouletteWheel({ spinning, size = 120 }) {
  const segments = 8;
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      border: '4px solid #fff3',
      overflow: 'hidden',
      position: 'relative',
      animation: spinning ? 'rr-wheel-spin 3s cubic-bezier(0.2,0.8,0.4,1) forwards' : 'rr-wheel-idle 3s ease-in-out infinite',
      boxShadow: '0 0 24px rgba(239,68,68,0.4)',
    }}>
      {colors.map((color, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: `conic-gradient(from ${i * (360/segments)}deg, ${color} 0deg, ${color} ${360/segments}deg, transparent ${360/segments}deg)`,
        }} />
      ))}
      <div style={{ position: 'absolute', inset: '35%', borderRadius: '50%', background: '#0e1019', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎰</div>
    </div>
  );
}

// ─── Pixel Boss ───────────────────────────────────────────────────────────────
function BacklogBoss({ hp, maxHp = 100, shaking }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ textAlign: 'center' }}>
      <div className={shaking ? 'rr-boss-shake' : 'rr-boss-growl'} style={{ fontSize: '60px', lineHeight: 1.1 }}>🎡</div>
      <div style={{ fontFamily: PF, fontSize: 7, color: '#ef4444', letterSpacing: 1, marginTop: 6 }}>THE UNGROOMED BACKLOG</div>
      <div style={{ marginTop: 8, padding: '0 16px' }}>
        <div style={{ fontFamily: PF, fontSize: 7, color: '#94a3b8', marginBottom: 4 }}>HP: {hp}/{maxHp}</div>
        <div style={{ height: 10, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden', border: '1px solid #4c1d95' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #ef4444, #dc2626)`, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RefinementRouletteScreen({ sessionId, user, onBack }) {
  injectRRStyles();

  const [phase, setPhase]               = useState('loading');
  // lobby | spin | silent_read | dod_write | dod_reveal | clarification | groomed
  const [session, setSession]           = useState(null);
  const [items, setItems]               = useState([]);
  const [chosenItem, setChosenItem]     = useState(null);
  const [spinning, setSpinning]         = useState(false);
  const [silentTimer, setSilentTimer]   = useState(SILENT_READ_DURATION);
  const [dodTimer, setDodTimer]         = useState(DOD_WRITE_DURATION);
  const [myDod, setMyDod]               = useState('');
  const [dodSubmissions, setDodSubmissions] = useState([]); // [{user_id, text}]
  const [clarifications, setClarifications] = useState([]); // [{user_id, text}]
  const [myClarification, setMyClarification] = useState('');
  const [clarVotes, setClarVotes]       = useState({}); // clarIdx → [user_id]
  const [myClarVote, setMyClarVote]     = useState(null);
  const [winningDod, setWinningDod]     = useState(null);
  const [winningClar, setWinningClar]   = useState(null);
  const [misalignScore, setMisalignScore] = useState(0);
  const [bossHp, setBossHp]             = useState(100);
  const [bossShaking, setBossShaking]   = useState(false);
  const [dmgNums, setDmgNums]           = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isGm, setIsGm]                 = useState(false);
  const [showSummary, setShowSummary]   = useState(false);
  const [dodApproved, setDodApproved]   = useState(false);
  const [clarApproved, setClarApproved] = useState(false);
  const [shakeScreen, setShakeScreen]   = useState(false);
  const dmgId    = useRef(0);
  const timerRef = useRef(null);

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId]); // eslint-disable-line

  async function loadSession() {
    const { session: sess, items: its } = await fetchSessionWithItems(sessionId);
    if (!sess) { setPhase('error'); return; }
    setSession(sess);
    setIsGm(sess.created_by === user?.id);
    setItems(its);

    // Load participants
    const parts = await fetchRawParticipants(sessionId);
    setParticipants(parts);

    // Load existing submissions if session was resumed
    const { data: existing } = await supabase.from('refinement_submissions').select('*').eq('session_id', sessionId).order('created_at');
    if (existing && existing.length > 0) {
      setDodSubmissions(existing.filter(e => e.type === 'dod'));
      setClarifications(existing.filter(e => e.type === 'clarification'));
      // Find chosen item
      const chosenId = sess.metadata?.chosen_item_id;
      if (chosenId && its) {
        setChosenItem(its.find(i => i.id === chosenId) || null);
      }
    }

    setPhase('lobby');
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`refinement_roulette_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'refinement_submissions', filter: `session_id=eq.${sessionId}` }, payload => {
        const sub = payload.new;
        if (sub.type === 'dod') {
          setDodSubmissions(prev => {
            if (prev.find(s => s.user_id === sub.user_id)) return prev;
            return [...prev, sub];
          });
        } else if (sub.type === 'clarification') {
          setClarifications(prev => {
            if (prev.find(s => s.user_id === sub.user_id)) return prev;
            return [...prev, sub];
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'refinement_votes', filter: `session_id=eq.${sessionId}` }, payload => {
        const v = payload.new;
        setClarVotes(prev => {
          const cur = prev[v.clarification_idx] || [];
          if (cur.includes(v.user_id)) return prev;
          return { ...prev, [v.clarification_idx]: [...cur, v.user_id] };
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  // ── Spin & Pick item ──────────────────────────────────────────────────────
  async function spinRoulette() {
    if (items.length === 0) return;
    setSpinning(true);
    playSpinSound();
    // Wait for animation (3s) then reveal
    setTimeout(async () => {
      const idx = Math.floor(Math.random() * items.length);
      const item = items[idx];
      setChosenItem(item);
      setSpinning(false);
      playDingReveal();
      spawnDmg('BACKLOG ITEM REVEALED!', '#f59e0b', 50);
      // Persist chosen item in session metadata
      await supabase.from('sessions').update({ metadata: { chosen_item_id: item.id } }).eq('id', sessionId);
      setTimeout(() => setPhase('silent_read'), 800);
    }, 3200);
  }

  // ── Silent read timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'silent_read') return;
    playBossGrowl();
    setSilentTimer(SILENT_READ_DURATION);
    timerRef.current = setInterval(() => {
      setSilentTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase('dod_write');
          setDodTimer(DOD_WRITE_DURATION);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line

  // ── DoD write timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'dod_write') return;
    timerRef.current = setInterval(() => {
      setDodTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          playTimerEnd();
          moveToDodReveal();
          return 0;
        }
        if (t <= 15) playTone(660 - (15 - t) * 20, 'square', 0.05, 0.05);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line

  // ── Submit DoD ─────────────────────────────────────────────────────────────
  async function submitDod() {
    if (!myDod.trim()) return;
    await supabase.from('refinement_submissions').insert({ session_id: sessionId, user_id: user.id, type: 'dod', text: myDod.trim() });
    setMyDod('');
    playVotePick();
    spawnDmg('DoD submitted!', '#22c55e', 60);
  }

  // ── Move to DoD reveal ─────────────────────────────────────────────────────
  function moveToDodReveal() {
    const allTexts = dodSubmissions.map(s => s.text);
    const score = computeMisalignment(allTexts);
    setMisalignScore(score);
    if (score > 60) {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 600);
      spawnDmg(`⚡ MISALIGNMENT: ${score}%`, '#ef4444', 40);
      // Boss gains HP from misalignment
      setBossHp(hp => Math.min(100, hp + Math.round(score * 0.3)));
      playBossGrowl();
    } else {
      // Boss loses HP from alignment
      setBossHp(hp => Math.max(0, hp - 20));
      spawnDmg(`Alignment: ${100 - score}%`, '#22c55e', 40);
    }
    setPhase('dod_reveal');
  }

  // ── GM approve DoD ─────────────────────────────────────────────────────────
  async function approveDod(text) {
    if (!isGm || !chosenItem) return;
    await supabase.from('approval_queue').insert({
      session_id: sessionId,
      item_id: chosenItem.id,
      type: 'acceptance_criteria',
      proposed_value: text,
      proposed_by: user.id,
    }).select().maybeSingle();
    setWinningDod(text);
    setDodApproved(true);
    playApprove();
    spawnDmg('✓ DoD → PM queue', '#22c55e', 50);
    setBossHp(hp => Math.max(0, hp - 25));
    setBossShaking(true);
    setTimeout(() => setBossShaking(false), 500);
  }

  // ── Submit clarification ───────────────────────────────────────────────────
  async function submitClarification() {
    if (!myClarification.trim()) return;
    await supabase.from('refinement_submissions').insert({ session_id: sessionId, user_id: user.id, type: 'clarification', text: myClarification.trim() });
    setMyClarification('');
    playVotePick();
  }

  // ── Vote on clarification ──────────────────────────────────────────────────
  async function voteClarification(idx) {
    if (myClarVote === idx) return;
    setMyClarVote(idx);
    playVotePick();
    await supabase.from('refinement_votes').insert({ session_id: sessionId, user_id: user.id, clarification_idx: idx });
  }

  // ── GM approve winning clarification ──────────────────────────────────────
  async function approveWinningClarification() {
    if (!isGm || !chosenItem) return;
    const bestIdx = Object.entries(clarVotes).sort((a, b) => b[1].length - a[1].length)[0]?.[0];
    if (bestIdx === undefined) return;
    const text = clarifications[parseInt(bestIdx)]?.text;
    if (!text) return;
    await supabase.from('approval_queue').insert({
      session_id: sessionId,
      item_id: chosenItem.id,
      type: 'description_append',
      proposed_value: text,
      proposed_by: user.id,
    }).select().maybeSingle();
    // Mark item as groomed (direct write)
    await supabase.from('session_items').update({ is_groomed: true }).eq('id', chosenItem.id);
    setWinningClar(text);
    setClarApproved(true);
    playApprove();
    spawnDmg('✓ Clarification → PM', '#22c55e', 50);
    setBossHp(hp => Math.max(0, hp - 30));
    setBossShaking(true);
    setTimeout(() => setBossShaking(false), 500);
    // XP award handled by backend trigger
    setPhase('groomed');
  }

  // ── Damage numbers ────────────────────────────────────────────────────────
  function spawnDmg(text, color, xPct) {
    const id = ++dmgId.current;
    setDmgNums(prev => [...prev, { id, text, color, x: xPct, y: 180 + Math.random() * 60 }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1800);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const C = {
    bg: '#0e0a1e', panel: '#14102a', text: '#e2e8f0', text2: '#94a3b8',
    purple: '#7c3aed', gold: '#f59e0b', green: '#22c55e', red: '#ef4444',
  };

  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: PF, color: C.purple }}>LOADING REFINEMENT ROULETTE...</div>;
  }

  if (showSummary) {
    return (
      <PostSessionSummary
        sessionId={sessionId}
        sessionType="refinement_roulette"
        results={{
          item_title: chosenItem?.title || 'Backlog item',
          misalignment_score: misalignScore,
          dod_saved: dodApproved,
          clarification_saved: clarApproved,
        }}
        approvalPending={!dodApproved || !clarApproved}
        approvalItems={[
          !dodApproved ? 'Definition of Done → acceptance_criteria' : null,
          !clarApproved ? 'Winning clarification → item description' : null,
        ].filter(Boolean)}
        teamId={session?.world_id || session?.organization_id}
        onBack={onBack}
      />
    );
  }

  const allDoDs = dodSubmissions.map(s => s.text);
  const topClarification = clarifications[
    parseInt(Object.entries(clarVotes).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? '0')
  ] || null;

  return (
    <div className={shakeScreen ? 'rr-shake' : ''} style={{ minHeight: '100vh', background: C.bg, fontFamily: PF, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.13) 3px,rgba(0,0,0,0.13) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Damage numbers */}
      {dmgNums.map(d => (
        <div key={d.id} style={{ position: 'fixed', left: `${d.x}%`, top: `${d.y}px`, fontFamily: PF, fontSize: 11, color: d.color, textShadow: `0 0 8px ${d.color}`, pointerEvents: 'none', zIndex: 50, animation: 'rr-xp-pop 1.6s ease-out forwards' }}>
          {d.text}
        </div>
      ))}

      {/* Header HUD */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <SoundToggle />
        <GameXPBar userId={user?.id} organizationId={session?.organization_id} />
      </div>
      {user && <XPBadgeNotifier userId={user.id} organizationId={session?.organization_id} />}

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>

        {/* Nav header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 9, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>← BACK</button>
          <div>
            <div style={{ fontSize: 14, color: C.purple, letterSpacing: 2 }}>🎰 REFINEMENT ROULETTE</div>
            <div style={{ fontSize: 8, color: C.text2, marginTop: 3 }}>{session?.title || 'Session'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
            {misalignScore > 0 && (
              <div style={{ fontFamily: PF, fontSize: 8, color: misalignScore > 60 ? C.red : C.green }}>
                ⚡ MISALIGN: {misalignScore}%
              </div>
            )}
            <div style={{ fontFamily: PF, fontSize: 8, color: C.text2 }}>
              {participants.length} players
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>

          {/* Left: Boss */}
          <div>
            <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(239,68,68,0.25)', marginBottom: 12 }}>
              <BacklogBoss hp={bossHp} shaking={bossShaking} />
            </div>

            {/* Phase tracker */}
            <div style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 6, padding: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 7, color: C.text2, marginBottom: 8, fontFamily: PF }}>PHASE</div>
              {['lobby','spin','silent_read','dod_write','dod_reveal','clarification','groomed'].map(p => {
                const phases = ['lobby','spin','silent_read','dod_write','dod_reveal','clarification','groomed'];
                const current = phases.indexOf(phase);
                const thisIdx = phases.indexOf(p);
                const done = thisIdx < current;
                const active = p === phase;
                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: done ? C.green : active ? C.purple : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    <div style={{ fontFamily: VT, fontSize: 13, color: done ? C.green : active ? C.purple : C.text2 }}>
                      {p.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Participants */}
            {participants.length > 0 && (
              <div style={{ marginTop: 12, background: 'rgba(124,58,237,0.05)', borderRadius: 6, padding: 10, border: '1px solid rgba(124,58,237,0.15)' }}>
                <div style={{ fontSize: 7, color: C.text2, marginBottom: 6, fontFamily: PF }}>PLAYERS</div>
                {participants.map((p, i) => (
                  <div key={i} style={{ fontFamily: VT, fontSize: 14, color: C.text2, marginBottom: 2 }}>
                    👤 {p.profiles?.name || `Player ${i + 1}`}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Main content */}
          <div>

            {/* ── LOBBY ────────────────────────────────────── */}
            {phase === 'lobby' && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 28, border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize: 12, color: C.purple, marginBottom: 16 }}>HVAD ER REFINEMENT ROULETTE?</div>
                <div style={{ fontFamily: VT, fontSize: 17, color: C.text2, lineHeight: 1.8, marginBottom: 24 }}>
                  🎰 Et random item trækkes fra backloggen.<br />
                  📖 Alle læser det i 60 sek — ingen må tale.<br />
                  ✍️ Alle skriver deres Definition of Done (2 min).<br />
                  ⚡ Misalignment afsløres — jo mere forskelligt, desto mere boss HP.<br />
                  🔍 Alle foreslår den vigtigste clarification og voter.<br />
                  ✅ GM godkender DoD + clarification → gemt til PM.<br /><br />
                  <span style={{ color: C.gold }}>🎯 Formål: Tvinger alle til at have en mening. Ingen kan sidde stille.</span>
                </div>
                <div style={{ marginBottom: 20, background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 4 }}>BACKLOG KLAR</div>
                  <div style={{ fontFamily: VT, fontSize: 18, color: C.purple }}>{items.length} items tilgængelige</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RouletteWheel spinning={false} size={100} />
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {isGm ? (
                    <button
                      onClick={() => setPhase('spin')}
                      disabled={items.length === 0}
                      style={{ fontFamily: PF, fontSize: 10, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '14px 28px', cursor: 'pointer', opacity: items.length === 0 ? 0.5 : 1 }}
                    >
                      🎰 START ROULETTE
                    </button>
                  ) : (
                    <div style={{ fontFamily: PF, fontSize: 8, color: C.text2 }}>WAITING FOR GAME MASTER...</div>
                  )}
                </div>
              </div>
            )}

            {/* ── SPIN ─────────────────────────────────────── */}
            {phase === 'spin' && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 32, border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.gold, marginBottom: 20, letterSpacing: 2 }}>SPINNING THE WHEEL...</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <RouletteWheel spinning={spinning} size={160} />
                </div>
                {!spinning && !chosenItem && isGm && (
                  <button
                    onClick={spinRoulette}
                    style={{ fontFamily: PF, fontSize: 10, color: '#0e1019', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: 4, padding: '14px 28px', cursor: 'pointer' }}
                  >
                    🎰 SPIN!
                  </button>
                )}
                {spinning && (
                  <div style={{ fontFamily: PF, fontSize: 9, color: C.text2 }}>...🎰...</div>
                )}
                {chosenItem && (
                  <div className="rr-reveal-pop" style={{ marginTop: 20, background: 'rgba(245,158,11,0.1)', borderRadius: 6, padding: 20, border: '2px solid #f59e0b' }}>
                    <div style={{ fontSize: 10, color: C.gold, marginBottom: 8 }}>BACKLOG ITEM REVEALED!</div>
                    <div style={{ fontFamily: VT, fontSize: 22, color: C.text }}>{chosenItem.title}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── SILENT READ ──────────────────────────────── */}
            {phase === 'silent_read' && chosenItem && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 24, border: '1px solid rgba(124,58,237,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: C.purple }}>🤫 SILENT READ</div>
                  <div
                    style={{ fontSize: 24, color: silentTimer <= 10 ? C.red : C.text, fontFamily: PF }}
                    className={silentTimer <= 10 ? 'rr-timer-pulse' : ''}
                  >
                    {formatTime(silentTimer)}
                  </div>
                </div>
                <div style={{ fontFamily: VT, fontSize: 11, color: C.text2, textAlign: 'center', marginBottom: 20, padding: '8px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)' }}>
                  🤫 LÆS — INGEN MÅ TALE I 60 SEK
                </div>
                <div style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 6, padding: 20, border: '1px solid rgba(124,58,237,0.25)' }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 10 }}>ITEM</div>
                  <div style={{ fontFamily: VT, fontSize: 22, color: C.text, marginBottom: 12 }}>{chosenItem.title}</div>
                  {chosenItem.description && (
                    <div style={{ fontFamily: VT, fontSize: 16, color: C.text2, lineHeight: 1.6 }}>{chosenItem.description}</div>
                  )}
                  {chosenItem.acceptance_criteria && (
                    <div style={{ marginTop: 12, padding: 10, background: 'rgba(34,197,94,0.08)', borderRadius: 4, border: '1px solid rgba(34,197,94,0.2)' }}>
                      <div style={{ fontSize: 7, color: C.green, marginBottom: 4, fontFamily: PF }}>EKSISTERENDE ACCEPTANCE CRITERIA</div>
                      <div style={{ fontFamily: VT, fontSize: 14, color: C.text2 }}>{chosenItem.acceptance_criteria}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DOD WRITE ─────────────────────────────────── */}
            {phase === 'dod_write' && chosenItem && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 24, border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.green }}>✍️ DEFINITION OF DONE</div>
                  <div style={{ fontSize: 22, color: dodTimer <= 15 ? C.red : C.gold, fontFamily: PF }}>
                    {formatTime(dodTimer)}
                  </div>
                </div>
                <div style={{ fontFamily: VT, fontSize: 15, color: C.text2, marginBottom: 16, lineHeight: 1.6 }}>
                  Hvad skal til for at <span style={{ color: C.gold }}>"{chosenItem.title}"</span> er DONE?<br />
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>Skriv dit svar individuelt — anonymt reveal bagefter.</span>
                </div>
                <textarea
                  value={myDod}
                  onChange={e => setMyDod(e.target.value)}
                  placeholder="Skriv din Definition of Done..."
                  rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '10px 14px', color: C.text, fontFamily: VT, fontSize: 16, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={submitDod}
                    disabled={!myDod.trim() || dodSubmissions.some(s => s.user_id === user?.id)}
                    style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', opacity: (!myDod.trim() || dodSubmissions.some(s => s.user_id === user?.id)) ? 0.5 : 1 }}
                  >
                    {dodSubmissions.some(s => s.user_id === user?.id) ? '✓ SUBMITTED' : 'SUBMIT ANONYMOUSLY →'}
                  </button>
                  {isGm && (
                    <button
                      onClick={() => { clearInterval(timerRef.current); moveToDodReveal(); }}
                      style={{ fontFamily: PF, fontSize: 8, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '10px 14px', cursor: 'pointer' }}
                    >
                      REVEAL NOW →
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: 8, color: C.text2 }}>
                  {dodSubmissions.length}/{participants.length || '?'} submitted
                </div>
              </div>
            )}

            {/* ── DOD REVEAL ─────────────────────────────────── */}
            {phase === 'dod_reveal' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.gold }}>⚡ DOD REVEAL</div>
                  <div style={{ fontFamily: PF, fontSize: 10, color: misalignScore > 60 ? C.red : C.green }}>
                    MISALIGNMENT: {misalignScore}%
                  </div>
                </div>

                {/* Misalignment bar */}
                <div style={{ marginBottom: 16, background: C.panel, borderRadius: 4, padding: 10, border: `1px solid ${misalignScore > 60 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}` }}>
                  <div style={{ height: 12, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${misalignScore}%`, background: `linear-gradient(90deg, ${misalignScore > 60 ? '#ef4444' : '#22c55e'}, ${misalignScore > 60 ? '#dc2626' : '#16a34a'})`, transition: 'width 0.8s ease' }} />
                  </div>
                  {misalignScore > 60 && (
                    <div style={{ fontFamily: VT, fontSize: 14, color: C.red }}>
                      ⚡ Stor misalignment — teamet har MEGET forskellig forståelse af done. Diskuter!
                    </div>
                  )}
                  {misalignScore <= 30 && (
                    <div style={{ fontFamily: VT, fontSize: 14, color: C.green }}>
                      ✅ Høj alignment — teamet er enige om hvad done betyder.
                    </div>
                  )}
                </div>

                {/* All DoD submissions (anon order) */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 10 }}>ALLE DEFINITION OF DONE SUBMISSIONS</div>
                  {dodSubmissions.map((sub, i) => {
                    const uniqueWords = getUniqueWords(sub.text, allDoDs);
                    const words = sub.text.split(/(\W+)/);
                    return (
                      <div key={i} style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: 14, marginBottom: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div style={{ fontFamily: VT, fontSize: 16, color: C.text, lineHeight: 1.6 }}>
                          {words.map((word, wi) => (
                            <span key={wi} style={{ color: uniqueWords.has(word.toLowerCase().replace(/\W/g, '')) && word.trim().length > 3 ? C.red : C.text }}>
                              {word}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontFamily: PF, fontSize: 7, color: C.text2, marginTop: 4 }}>
                          Player #{i + 1} — <span style={{ color: C.red }}>røde ord = kun denne person brugte dem</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* GM: pick winning DoD */}
                {isGm && !dodApproved && dodSubmissions.length > 0 && (
                  <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 6, padding: 16, border: '1px solid rgba(34,197,94,0.3)', marginBottom: 16 }}>
                    <div style={{ fontSize: 8, color: C.green, marginBottom: 10 }}>GM: VÆLG VINDENDE DOD → ACCEPTANCE CRITERIA</div>
                    {dodSubmissions.map((sub, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontFamily: VT, fontSize: 14, color: C.text, flex: 1 }}>#{i + 1}: {sub.text.slice(0, 80)}...</div>
                        <button
                          onClick={() => approveDod(sub.text)}
                          style={{ fontFamily: PF, fontSize: 7, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 3, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8 }}
                        >
                          ✓ SELECT
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {dodApproved && winningDod && (
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 4, padding: 12, border: '1px solid rgba(34,197,94,0.4)', marginBottom: 16 }}>
                    <div style={{ fontSize: 7, color: C.green, fontFamily: PF, marginBottom: 4 }}>✓ DOD GODKENDT → APPROVAL QUEUE</div>
                    <div style={{ fontFamily: VT, fontSize: 15, color: C.text }}>{winningDod}</div>
                  </div>
                )}

                <button
                  onClick={() => setPhase('clarification')}
                  style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer' }}
                >
                  NÆSTE: CLARIFICATION VOTE →
                </button>
              </div>
            )}

            {/* ── CLARIFICATION VOTE ────────────────────────── */}
            {phase === 'clarification' && chosenItem && (
              <div>
                <div style={{ fontSize: 11, color: C.purple, marginBottom: 16 }}>🔍 CLARIFICATION VOTE</div>
                <div style={{ fontFamily: VT, fontSize: 16, color: C.text2, marginBottom: 20 }}>
                  Hvad er det <span style={{ color: C.gold }}>VIGTIGSTE</span> der mangler i beskrivelsen af <span style={{ color: C.purple }}>"{chosenItem.title}"</span>?
                </div>

                {/* Submit clarification */}
                <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(124,58,237,0.2)', marginBottom: 16 }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>DIN CLARIFICATION</div>
                  <input
                    value={myClarification}
                    onChange={e => setMyClarification(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitClarification()}
                    placeholder="Hvad mangler i item-beskrivelsen?"
                    disabled={clarifications.some(c => c.user_id === user?.id)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 4, padding: '8px 12px', color: C.text, fontFamily: VT, fontSize: 16, marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={submitClarification}
                    disabled={!myClarification.trim() || clarifications.some(c => c.user_id === user?.id)}
                    style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', opacity: (!myClarification.trim() || clarifications.some(c => c.user_id === user?.id)) ? 0.5 : 1 }}
                  >
                    {clarifications.some(c => c.user_id === user?.id) ? '✓ SUBMITTED' : 'SUBMIT →'}
                  </button>
                </div>

                {/* Vote on clarifications */}
                {clarifications.length > 0 && (
                  <div>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 10 }}>VOTE: HVAD ER VIGTIGST?</div>
                    {clarifications.map((clar, i) => {
                      const voteCount = (clarVotes[i] || []).length;
                      const myVote = myClarVote === i;
                      return (
                        <div key={i} style={{ background: myVote ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', borderRadius: 4, padding: 14, marginBottom: 8, border: `1px solid ${myVote ? C.purple : 'rgba(255,255,255,0.1)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontFamily: VT, fontSize: 16, color: C.text, flex: 1 }}>{clar.text}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                            <div style={{ fontFamily: PF, fontSize: 9, color: C.purple }}>{voteCount} votes</div>
                            <button
                              onClick={() => voteClarification(i)}
                              disabled={myVote}
                              style={{ fontFamily: PF, fontSize: 7, color: myVote ? '#0e1019' : C.purple, background: myVote ? C.purple : 'none', border: `1px solid ${C.purple}`, borderRadius: 3, padding: '4px 10px', cursor: myVote ? 'default' : 'pointer' }}
                            >
                              {myVote ? '✓' : 'VOTE'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* GM: approve winning */}
                {isGm && clarifications.length > 0 && !clarApproved && (
                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={approveWinningClarification}
                      style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer', width: '100%' }}
                    >
                      ✓ GODKEND VINDER → GROOMED!
                    </button>
                  </div>
                )}
                {clarApproved && (
                  <div style={{ marginTop: 12, fontSize: 8, color: C.green, textAlign: 'center' }}>✓ CLARIFICATION GEMT → PM QUEUE</div>
                )}
              </div>
            )}

            {/* ── GROOMED! ─────────────────────────────────── */}
            {phase === 'groomed' && (
              <div className="rr-reveal-pop" style={{ background: C.panel, borderRadius: 6, padding: 32, border: '2px solid #22c55e', textAlign: 'center' }}>
                <div className="rr-groomed" style={{ fontSize: '80px', marginBottom: 16 }}>🌿</div>
                <div style={{ fontSize: 16, color: C.green, marginBottom: 8 }}>ITEM GROOMED!</div>
                <div style={{ fontFamily: VT, fontSize: 20, color: C.text, marginBottom: 20 }}>
                  {chosenItem?.title}
                </div>
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 4, padding: 16, border: '1px solid rgba(34,197,94,0.3)', marginBottom: 20 }}>
                  <div style={{ fontFamily: VT, fontSize: 16, color: C.text2, lineHeight: 1.8 }}>
                    ✓ Definition of Done → acceptance_criteria<br />
                    ✓ Clarification → item description<br />
                    ✓ is_groomed = true
                  </div>
                </div>
                <div style={{ fontSize: 24, color: C.gold, fontFamily: PF, marginBottom: 16 }}>+45 XP 🎉</div>
                <button
                  onClick={() => setShowSummary(true)}
                  style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer' }}
                >
                  VIEW SESSION SUMMARY →
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
