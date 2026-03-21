import { handleSoftError } from "../lib/errorHandler";

/**
 * Assumption Slayer — Anonymous assumption danger voting
 *
 * Phase 1 — Write (3 min timer): each participant writes 1-3 assumptions anonymously.
 * Phase 2 — Vote: rate each assumption's danger level (1-5).
 * Reveal: ranked list, most dangerous first. Boss = "The False Assumption".
 * Write-back: top-3 assumptions as project comments (GM approval).
 *
 * Flow:
 *   lobby → write (3min) → vote → reveal → summary
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { DmgNum } from '../components/session/SessionPrimitives.jsx';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const WRITE_DURATION = 180; // 3 minutes in seconds
const DANGER_LABELS = { 1: 'HARMLESS', 2: 'RISKY', 3: 'DANGEROUS', 4: 'VERY DANGEROUS', 5: '☠ LETHAL' };
const DANGER_COLORS = { 1: '#22c55e', 2: '#84cc16', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };

// ─── Style injection ─────────────────────────────────────────────────────────
let asStylesInjected = false;
function injectASStyles() {
  if (asStylesInjected) return;
  asStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes as-dragon-idle {
      0%,100%{transform:translateY(0) scaleX(1)}
      50%{transform:translateY(-6px) scaleX(1.02)}
    }
    @keyframes as-dragon-hurt {
      0%{transform:rotate(0deg) translateX(0)}
      20%{transform:rotate(-10deg) translateX(-8px)}
      40%{transform:rotate(10deg) translateX(8px)}
      60%{transform:rotate(-6deg) translateX(-4px)}
      80%{transform:rotate(6deg) translateX(4px)}
      100%{transform:rotate(0deg) translateX(0)}
    }
    @keyframes as-scroll-in {
      0%{opacity:0;transform:translateY(16px) rotate(-2deg)}
      100%{opacity:1;transform:translateY(0) rotate(0deg)}
    }
    @keyframes as-reveal-scroll {
      0%{opacity:0;transform:scaleY(0);transform-origin:top}
      100%{opacity:1;transform:scaleY(1)}
    }
    @keyframes as-danger-bar {
      from{width:0}
      to{width:var(--danger-w)}
    }
    @keyframes as-timer-pulse {
      0%,100%{transform:scale(1);color:#ef4444}
      50%{transform:scale(1.3);color:#fca5a5}
    }
    @keyframes as-card-select {
      0%{transform:scale(1)}
      50%{transform:scale(1.15)}
      100%{transform:scale(1.05)}
    }
    @keyframes as-fire {
      0%,100%{opacity:0.6;transform:scaleY(1) translateY(0)}
      50%{opacity:1;transform:scaleY(1.2) translateY(-4px)}
    }
    @keyframes as-rank-slide {
      from{opacity:0;transform:translateX(-30px)}
      to{opacity:1;transform:translateX(0)}
    }
    .as-dragon-idle    { animation: as-dragon-idle 2s ease-in-out infinite; }
    .as-dragon-hurt    { animation: as-dragon-hurt 0.5s ease-in-out; }
    .as-scroll-in      { animation: as-scroll-in 0.4s ease-out forwards; }
    .as-reveal-scroll  { animation: as-reveal-scroll 0.4s ease-out forwards; }
    .as-card-selected  { animation: as-card-select 0.25s ease forwards; }
    .as-rank-slide     { animation: as-rank-slide 0.4s ease-out forwards; }
    .as-fire           { animation: as-fire 0.8s ease-in-out infinite; }
    .as-timer-urgent   { animation: as-timer-pulse 0.5s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── Audio ───────────────────────────────────────────────────────────────────
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
  } catch (e) { handleSoftError(e, 'audio-tone'); }
}

function playScrollWrite()  { playTone(440, 'square', 0.08, 0.08); }
function playDangerVote(d)  { playTone(200 + d * 60, 'sawtooth', 0.15, 0.1 + d * 0.02); }
function playDragonRoar() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const rumble = ctx.createOscillator();
    const g = ctx.createGain();
    rumble.connect(g); g.connect(ctx.destination);
    rumble.type = 'sawtooth'; rumble.frequency.value = 80;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    rumble.start(); rumble.stop(ctx.currentTime + 1.5);
    const screech = ctx.createOscillator();
    const g2 = ctx.createGain();
    screech.connect(g2); g2.connect(ctx.destination);
    screech.type = 'square'; screech.frequency.setValueAtTime(800, ctx.currentTime + 0.3);
    screech.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.0);
    g2.gain.setValueAtTime(0.0, ctx.currentTime + 0.3);
    g2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    screech.start(ctx.currentTime + 0.3); screech.stop(ctx.currentTime + 1.2);
    setTimeout(() => ctx.close(), 1800);
  } catch (e) { handleSoftError(e, 'audio-victory'); }
}
function playSlayFanfare()  { [523, 784, 1047, 1568].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.25, 0.12), i * 100)); }
function playTimerEnd()     { [220, 180, 150].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.3, 0.15), i * 120)); }
function playVerdictSave()  { [784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.15, 0.1), i * 80)); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avgDanger(votes) {
  if (!votes.length) return 0;
  return votes.reduce((a, b) => a + b.danger, 0) / votes.length;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DragonBoss({ hp, isHurt }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div className={isHurt ? 'as-dragon-hurt' : 'as-dragon-idle'} style={{ fontSize: '64px', lineHeight: 1, display: 'inline-block', filter: `hue-rotate(${(100 - hp) * 2}deg)` }}>
        🐉
      </div>
      {/* Flames */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="as-fire" style={{ fontSize: 16, animationDelay: `${i * 0.15}s`, opacity: hp < 50 ? 1 : 0.5 }}>🔥</div>
        ))}
      </div>
      <div style={{ fontFamily: PF, fontSize: 8, color: '#7c3aed', marginTop: 8 }}>
        THE FALSE ASSUMPTION
      </div>
      <div style={{ marginTop: 8, padding: '0 40px' }}>
        <div style={{ fontSize: 7, color: '#94a3b8', marginBottom: 4, fontFamily: PF }}>HP: {hp}/100</div>
        <div style={{ height: 10, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden', border: '1px solid #4c1d95' }}>
          <div style={{ height: '100%', width: `${hp}%`, background: 'linear-gradient(90deg, #7c3aed, #5b21b6)', transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
}

function DangerCard({ value, selected, onSelect, disabled }) {
  const color = DANGER_COLORS[value];
  return (
    <button
      className={selected ? 'as-card-selected' : ''}
      disabled={disabled}
      onClick={() => { if (!disabled) { playDangerVote(value); onSelect(value); } }}
      style={{
        fontFamily: PF, fontSize: 13,
        color: selected ? '#0e1019' : '#a0aec0',
        background: selected ? `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` : 'rgba(255,255,255,0.04)',
        border: selected ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        padding: '10px 14px',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 52,
        transition: 'all 0.15s',
      }}
    >
      {value}
      <div style={{ fontFamily: VT, fontSize: 9, marginTop: 3, opacity: 0.8 }}>
        {value === 1 ? '🌱' : value === 2 ? '⚠' : value === 3 ? '🔥' : value === 4 ? '💀' : '☠'}
      </div>
    </button>
  );
}

function AssumptionScroll({ assumption, index, showDanger, myVote, onVote, disabled, verdict, onVerdict, isGm }) {
  const danger = showDanger ? avgDanger(assumption.votes || []) : null;
  const dangerColor = danger ? DANGER_COLORS[Math.round(danger)] : '#94a3b8';

  return (
    <div className={showDanger ? 'as-reveal-scroll' : 'as-scroll-in'} style={{
      background: 'rgba(124,58,237,0.08)',
      border: `1px solid ${showDanger ? dangerColor : 'rgba(124,58,237,0.25)'}`,
      borderRadius: 6,
      padding: 16,
      marginBottom: 12,
      animationDelay: `${index * 0.08}s`,
      opacity: 0,
      animationFillMode: 'forwards',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {showDanger && (
            <div style={{ fontSize: 8, color: dangerColor, marginBottom: 6, fontFamily: PF }}>
              #{index + 1} — DANGER: {danger.toFixed(1)} — {DANGER_LABELS[Math.round(danger)] || '-'}
            </div>
          )}
          <div style={{ fontFamily: VT, fontSize: 17, color: '#e2e8f0', lineHeight: 1.4 }}>
            "{assumption.text}"
          </div>
          {showDanger && (
            <div style={{ marginTop: 8, height: 6, background: '#1a1c2e', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(danger / 5) * 100}%`,
                background: `linear-gradient(90deg, ${dangerColor}, ${dangerColor}bb)`,
                animation: 'as-danger-bar 0.6s ease-out',
                '--danger-w': `${(danger / 5) * 100}%`,
              }} />
            </div>
          )}
        </div>

        {/* Vote cards */}
        {!showDanger && !disabled && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <DangerCard key={v} value={v} selected={myVote === v} onSelect={onVote} disabled={disabled} />
            ))}
          </div>
        )}

        {/* Verdict (GM) */}
        {showDanger && isGm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <div style={{ fontSize: 7, color: '#94a3b8', fontFamily: PF, marginBottom: 2 }}>GM VERDICT</div>
            {[
              { key: 'investigate', label: '🔍 INVESTIGATE', color: '#f59e0b' },
              { key: 'valid', label: '⚠ VALID CONCERN', color: '#ef4444' },
              { key: 'addressed', label: '✓ ADDRESSED', color: '#22c55e' },
            ].map(v => (
              <button key={v.key} onClick={() => onVerdict(assumption.id, v.key)}
                style={{
                  fontFamily: VT, fontSize: 12,
                  color: verdict === v.key ? '#0e1019' : v.color,
                  background: verdict === v.key ? v.color : 'transparent',
                  border: `1px solid ${v.color}`,
                  borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                }}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssumptionSlayerScreen({ sessionId, user, onBack }) {
  injectASStyles();
  const [phase, setPhase]             = useState('loading'); // loading | lobby | write | vote | reveal | summary
  const [session, setSession]         = useState(null);
  const [assumptions, setAssumptions] = useState([]);
  const [myTexts, setMyTexts]         = useState(['', '', '']);
  const [myVotes, setMyVotes]         = useState({}); // assumptionId → danger 1-5
  const [allVotes, setAllVotes]       = useState({}); // assumptionId → [{user_id, danger}]
  const [verdicts, setVerdicts]       = useState({});  // assumptionId → verdict string
  const [revealed, setRevealed]       = useState(false);
  const [bossHp, setBossHp]           = useState(100);
  const [bossHurt, setBossHurt]       = useState(false);
  const [dmgNums, setDmgNums]         = useState([]);
  const [writeTimer, setWriteTimer]   = useState(WRITE_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isGm, setIsGm]               = useState(false);
  const [savedTop3, setSavedTop3]     = useState(false);
  const timerRef = useRef(null);
  const dmgId    = useRef(0);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId]); // eslint-disable-line

  async function loadSession() {
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!sess) { setPhase('error'); return; }
    setSession(sess);
    setIsGm(sess.created_by === user?.id);

    // Load existing assumptions
    const { data: existingAssumptions } = await supabase
      .from('assumptions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at');

    // Load votes
    const { data: votes } = await supabase
      .from('assumption_votes')
      .select('*')
      .eq('session_id', sessionId);

    const grouped = {};
    const myV = {};
    (votes || []).forEach(v => {
      if (!grouped[v.assumption_id]) grouped[v.assumption_id] = [];
      grouped[v.assumption_id].push(v);
      if (v.user_id === user?.id) myV[v.assumption_id] = v.danger;
    });

    setAllVotes(grouped);
    setMyVotes(myV);

    const asWithVotes = (existingAssumptions || []).map(a => ({ ...a, votes: grouped[a.id] || [] }));
    setAssumptions(asWithVotes);
    setPhase('lobby');
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`assumption_slayer_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assumptions', filter: `session_id=eq.${sessionId}` }, payload => {
        setAssumptions(prev => {
          if (prev.find(a => a.id === payload.new.id)) return prev;
          return [...prev, { ...payload.new, votes: [] }];
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assumption_votes', filter: `session_id=eq.${sessionId}` }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const v = payload.new;
          setAllVotes(prev => {
            const cur = prev[v.assumption_id] || [];
            const idx = cur.findIndex(x => x.user_id === v.user_id);
            if (idx >= 0) { const u = [...cur]; u[idx] = v; return { ...prev, [v.assumption_id]: u }; }
            return { ...prev, [v.assumption_id]: [...cur, v] };
          });
          setAssumptions(prev => prev.map(a => {
            if (a.id !== v.assumption_id) return a;
            const cur = a.votes || [];
            const idx = cur.findIndex(x => x.user_id === v.user_id);
            if (idx >= 0) { const u = [...cur]; u[idx] = v; return { ...a, votes: u }; }
            return { ...a, votes: [...cur, v] };
          }));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  // ── Write timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setWriteTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setTimerActive(false);
          playTimerEnd();
          setPhase('vote');
          return 0;
        }
        if (t <= 10) playTone(660 - (10 - t) * 30, 'square', 0.05, 0.06);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  // ── Start write phase ──────────────────────────────────────────────────────
  function startWritePhase() {
    setWriteTimer(WRITE_DURATION);
    setTimerActive(true);
    setPhase('write');
    playDragonRoar();
    spawnDmg('WRITE YOUR ASSUMPTIONS!', '#7c3aed', 200);
  }

  // ── Submit assumptions ─────────────────────────────────────────────────────
  async function submitAssumptions() {
    const texts = myTexts.filter(t => t.trim());
    if (!texts.length) return;
    for (const text of texts) {
      const { data: saved } = await supabase.from('assumptions').insert({
        session_id: sessionId,
        author_id: user.id,
        text: text.trim(),
      }).select().single();
      if (saved) {
        setAssumptions(prev => {
          if (prev.find(a => a.id === saved.id)) return prev;
          return [...prev, { ...saved, votes: [] }];
        });
        playScrollWrite();
      }
    }
    setMyTexts(['', '', '']);
    setTimerActive(false);
    clearInterval(timerRef.current);
    setPhase('vote');
  }

  // ── Submit vote ────────────────────────────────────────────────────────────
  async function submitVote(assumptionId, danger) {
    setMyVotes(prev => ({ ...prev, [assumptionId]: danger }));
    await supabase.from('assumption_votes').upsert({
      assumption_id: assumptionId,
      session_id: sessionId,
      user_id: user.id,
      danger,
    }, { onConflict: 'assumption_id,user_id' });
  }

  // ── Reveal ─────────────────────────────────────────────────────────────────
  function doReveal() {
    setRevealed(true);
    setPhase('reveal');
    playDragonRoar();
    // Compute boss HP damage
    const sorted = [...assumptions].sort((a, b) => avgDanger(b.votes || []) - avgDanger(a.votes || []));
    const top3 = sorted.slice(0, 3);
    const totalDanger = top3.reduce((sum, a) => sum + avgDanger(a.votes || []), 0);
    const dmg = Math.round(totalDanger * 4);
    setBossHp(hp => Math.max(0, hp - dmg));
    setBossHurt(true);
    setTimeout(() => setBossHurt(false), 600);
    spawnDmg(`-${dmg} HP`, '#ef4444', 180);
    spawnDmg('ASSUMPTIONS REVEALED!', '#7c3aed', 350);
    if (dmg >= 50) setTimeout(() => playSlayFanfare(), 700);
  }

  // ── GM Verdict ─────────────────────────────────────────────────────────────
  async function setVerdict(assumptionId, verdict) {
    setVerdicts(prev => ({ ...prev, [assumptionId]: verdict }));
    await supabase.from('assumptions').update({ gm_verdict: verdict }).eq('id', assumptionId);
    playVerdictSave();
    spawnDmg(`✓ ${verdict.toUpperCase()}`, '#22c55e', 220);
  }

  // ── Save top-3 as comments ─────────────────────────────────────────────────
  async function saveTop3AsComments() {
    if (!isGm || !session?.project_id) return;
    const sorted = [...assumptions].sort((a, b) => avgDanger(b.votes || []) - avgDanger(a.votes || []));
    const top3 = sorted.slice(0, 3);
    for (const [i, a] of top3.entries()) {
      const danger = avgDanger(a.votes || []);
      const text = `[Assumption Slayer] Top ${i + 1} dangerous assumption (danger: ${danger.toFixed(1)}/5): "${a.text}"${verdicts[a.id] ? ` — GM verdict: ${verdicts[a.id]}` : ''}`;
      await supabase.from('task_comments').insert({
        task_id: session.project_id, // adjust if project vs task
        author_id: user.id,
        content: text,
      }).select().maybeSingle();
    }
    setSavedTop3(true);
    playSlayFanfare();
    spawnDmg('TOP-3 SAVED!', '#22c55e', 240);
  }

  // ── Damage numbers ────────────────────────────────────────────────────────
  function spawnDmg(text, color, x) {
    const id = ++dmgId.current;
    const y = 160 + Math.random() * 80;
    setDmgNums(prev => [...prev, { id, text, color, x, y }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1800);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const sortedAssumptions = revealed
    ? [...assumptions].sort((a, b) => avgDanger(b.votes || []) - avgDanger(a.votes || []))
    : assumptions;

  const mySubmittedCount = assumptions.filter(a => a.author_id === user?.id).length;
  const totalVotes = Object.values(allVotes).reduce((s, v) => s + v.length, 0);
  const myVotedCount = Object.keys(myVotes).length;

  const C = { bg: '#0a0514', panel: '#120a1f', text: '#e2e8f0', text2: '#94a3b8', purple: '#7c3aed', red: '#ef4444' };

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: PF, color: C.purple }}>
        LOADING ASSUMPTION SLAYER...
      </div>
    );
  }

  if (showSummary) {
    const sorted = [...assumptions].sort((a, b) => avgDanger(b.votes || []) - avgDanger(a.votes || []));
    const maxDanger = sorted.length > 0 ? avgDanger(sorted[0].votes || []) : 0;
    return (
      <PostSessionSummary
        sessionId={sessionId}
        sessionType="assumption_slayer"
        results={{
          assumption_count: assumptions.length,
          max_danger: maxDanger.toFixed(1),
        }}
        approvalPending={isGm && !savedTop3 && session?.project_id}
        approvalItems={['Top-3 assumptions → project comments']}
        teamId={session?.world_id || session?.organization_id}
        onBack={onBack}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: PF, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.14) 3px,rgba(0,0,0,0.14) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Purple ambient */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Damage numbers */}
      {dmgNums.map(d => <DmgNum key={d.id} text={d.text} color={d.color} x={d.x} y={d.y} />)}

      {/* XP + Sound */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <SoundToggle />
        <GameXPBar userId={user?.id} organizationId={session?.organization_id} />
      </div>
      {user && <XPBadgeNotifier userId={user.id} organizationId={session?.organization_id} />}

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 9, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>← BACK</button>
          <div>
            <div style={{ fontSize: 16, color: C.purple, letterSpacing: 2 }}>⚔️ ASSUMPTION SLAYER</div>
            <div style={{ fontSize: 9, color: C.text2, marginTop: 4 }}>{session?.title || 'Session'}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.text2 }}>{assumptions.length} assumptions</div>
            {totalVotes > 0 && <div style={{ fontSize: 9, color: C.purple, marginTop: 2 }}>{totalVotes} votes cast</div>}
          </div>
        </div>

        {/* Layout: Boss left, content right */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>

          {/* Left: Dragon boss */}
          <div>
            <div style={{ background: C.panel, borderRadius: 6, padding: 12, border: '1px solid rgba(124,58,237,0.2)', marginBottom: 12 }}>
              <DragonBoss hp={bossHp} isHurt={bossHurt} />
            </div>

            {/* Phase indicator */}
            <div style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 6, padding: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>CURRENT PHASE</div>
              {['lobby', 'write', 'vote', 'reveal'].map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: phase === p ? C.purple : phase === 'reveal' && ['lobby', 'write', 'vote'].includes(p) ? '#22c55e' : 'rgba(255,255,255,0.1)',
                    flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 8, color: phase === p ? C.purple : phase === 'reveal' && ['lobby', 'write', 'vote'].includes(p) ? '#22c55e' : C.text2 }}>
                    {p.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            {revealed && (
              <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 7, color: C.text2, marginBottom: 8, fontFamily: PF }}>SESSION STATS</div>
                <div style={{ fontFamily: VT, fontSize: 14, color: C.text2, lineHeight: 2 }}>
                  Assumptions: {assumptions.length}<br />
                  Votes cast: {totalVotes}<br />
                  Boss HP: {bossHp}/100
                </div>
              </div>
            )}
          </div>

          {/* Right: Main content */}
          <div>

            {/* LOBBY PHASE */}
            {phase === 'lobby' && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 24, border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize: 12, color: C.purple, marginBottom: 16 }}>HOW IT WORKS</div>
                <div style={{ fontFamily: VT, fontSize: 16, color: C.text2, lineHeight: 1.8, marginBottom: 20 }}>
                  1. Each player writes 1-3 anonymous assumptions about this project/feature.<br />
                  2. The team votes on how dangerous each assumption is to have wrong (1-5).<br />
                  3. Reveal ranks assumptions from most to least dangerous.<br />
                  4. The False Assumption boss loses HP for every dangerous assumption revealed.<br />
                  5. Top-3 most dangerous assumptions can be saved as project reminders.
                </div>
                {isGm ? (
                  <button onClick={startWritePhase} style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer' }}>
                    ⚔️ START SLAYER SESSION
                  </button>
                ) : (
                  <div style={{ fontSize: 8, color: C.text2 }}>WAITING FOR GAME MASTER TO START...</div>
                )}
              </div>
            )}

            {/* WRITE PHASE */}
            {phase === 'write' && (
              <div>
                {/* Timer */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div className={writeTimer <= 30 ? 'as-timer-urgent' : ''} style={{
                    fontSize: writeTimer <= 30 ? 28 : 24,
                    color: writeTimer <= 30 ? C.red : C.purple,
                    fontFamily: PF,
                    display: 'inline-block',
                  }}>
                    {formatTime(writeTimer)}
                  </div>
                  <div style={{ fontSize: 8, color: C.text2, marginTop: 4 }}>WRITE YOUR ASSUMPTIONS — ANONYMOUS</div>
                </div>

                <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(124,58,237,0.2)', marginBottom: 12 }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 12 }}>WRITE 1-3 ASSUMPTIONS (WHAT MIGHT BE WRONG?)</div>
                  {myTexts.map((text, i) => (
                    <textarea
                      key={i}
                      value={text}
                      onChange={e => setMyTexts(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                      placeholder={`Assumption ${i + 1}... (optional)`}
                      rows={2}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.3)',
                        borderRadius: 4, padding: '8px 12px', color: C.text, fontFamily: VT, fontSize: 15,
                        marginBottom: 8, boxSizing: 'border-box', resize: 'vertical',
                      }}
                    />
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={submitAssumptions} disabled={!myTexts.some(t => t.trim())}
                      style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', opacity: !myTexts.some(t => t.trim()) ? 0.4 : 1 }}>
                      SUBMIT ANONYMOUSLY →
                    </button>
                    {mySubmittedCount > 0 && (
                      <button onClick={() => { setTimerActive(false); clearInterval(timerRef.current); setPhase('vote'); }}
                        style={{ fontFamily: PF, fontSize: 8, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '10px 16px', cursor: 'pointer' }}>
                        SKIP TO VOTE
                      </button>
                    )}
                  </div>
                </div>

                {/* Live count of submitted */}
                {assumptions.length > 0 && (
                  <div style={{ fontSize: 8, color: C.text2 }}>
                    {assumptions.length} assumption{assumptions.length !== 1 ? 's' : ''} submitted so far (anonymous)
                  </div>
                )}
              </div>
            )}

            {/* VOTE PHASE */}
            {phase === 'vote' && (
              <div>
                <div style={{ fontSize: 9, color: C.text2, marginBottom: 16 }}>
                  RATE EACH ASSUMPTION — HOW DANGEROUS IS IT TO HAVE THIS WRONG?
                </div>
                {assumptions.length === 0 && (
                  <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(124,58,237,0.2)', textAlign: 'center', color: C.text2 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
                    <div style={{ fontSize: 9 }}>NO ASSUMPTIONS SUBMITTED YET</div>
                    {isGm && (
                      <button onClick={startWritePhase} style={{ marginTop: 12, fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}>
                        ← BACK TO WRITE
                      </button>
                    )}
                  </div>
                )}

                {assumptions.map((a, i) => (
                  <AssumptionScroll
                    key={a.id}
                    assumption={a}
                    index={i}
                    showDanger={false}
                    myVote={myVotes[a.id]}
                    onVote={danger => submitVote(a.id, danger)}
                    disabled={false}
                    isGm={isGm}
                  />
                ))}

                <div style={{ marginTop: 12, fontSize: 8, color: C.text2, marginBottom: 12 }}>
                  YOU VOTED: {myVotedCount}/{assumptions.length}
                </div>

                {isGm && assumptions.length > 0 && (
                  <button onClick={doReveal}
                    style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer', width: '100%' }}>
                    ⚔️ SLAY THE ASSUMPTIONS
                  </button>
                )}
              </div>
            )}

            {/* REVEAL PHASE */}
            {phase === 'reveal' && (
              <div>
                <div style={{ fontSize: 9, color: C.purple, marginBottom: 4 }}>
                  ASSUMPTIONS RANKED BY DANGER
                </div>
                <div style={{ fontSize: 8, color: C.text2, marginBottom: 16 }}>
                  Most dangerous assumptions revealed — top-3 can be saved as project reminders
                </div>

                {sortedAssumptions.map((a, i) => (
                  <AssumptionScroll
                    key={a.id}
                    assumption={{ ...a, votes: allVotes[a.id] || a.votes || [] }}
                    index={i}
                    showDanger={true}
                    myVote={myVotes[a.id]}
                    onVote={() => {}}
                    disabled={true}
                    verdict={verdicts[a.id] || a.gm_verdict}
                    onVerdict={setVerdict}
                    isGm={isGm}
                  />
                ))}

                {/* Save top-3 */}
                {isGm && session?.project_id && !savedTop3 && (
                  <button onClick={saveTop3AsComments}
                    style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', width: '100%', marginTop: 8 }}>
                    ✓ SAVE TOP-3 TO PROJECT
                  </button>
                )}
                {savedTop3 && (
                  <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginTop: 8 }}>✓ TOP-3 ASSUMPTIONS SAVED AS PROJECT COMMENTS</div>
                )}

                <button onClick={() => { playSlayFanfare(); setShowSummary(true); }}
                  style={{ fontFamily: PF, fontSize: 8, color: C.purple, background: 'none', border: `1px solid ${C.purple}`, borderRadius: 4, padding: '10px 20px', cursor: 'pointer', width: '100%', marginTop: 12 }}>
                  VIEW SUMMARY →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
