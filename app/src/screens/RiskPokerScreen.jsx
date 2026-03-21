/**
 * Risk Poker — Two-dimensional risk assessment
 *
 * Two-card voting: probability (1-5) + impact (1-5) per risk item.
 * Reveal: 5×5 risk matrix with all risks plotted.
 * Hot spots = upper-right quadrant.
 * GM approves → risks saved to `risks` table.
 *
 * Flow:
 *   lobby → add risks → voting (prob + impact) → reveal (matrix) → summary
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { DmgNum, Scene } from '../components/session/SessionPrimitives.jsx';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const SCALE = [1, 2, 3, 4, 5];
const SCALE_LABELS = { 1: 'VERY LOW', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH', 5: 'CRITICAL' };
const IMPACT_LABELS  = { 1: 'TRIVIAL', 2: 'MINOR', 3: 'MODERATE', 4: 'MAJOR', 5: 'CATASTROPHIC' };

// ─── Style injection ────────────────────────────────────────────────────────
let rpStylesInjected = false;
function injectRPStyles() {
  if (rpStylesInjected) return;
  rpStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes rp-hotspot-pulse {
      0%,100%{box-shadow:0 0 8px #ef4444,0 0 16px #ef4444}
      50%{box-shadow:0 0 24px #ef4444,0 0 48px #ef4444,0 0 64px rgba(239,68,68,0.4)}
    }
    @keyframes rp-matrix-cell-in {
      0%{opacity:0;transform:scale(0)}
      70%{transform:scale(1.1)}
      100%{opacity:1;transform:scale(1)}
    }
    @keyframes rp-risk-dot-in {
      0%{opacity:0;transform:scale(0) rotate(-180deg)}
      80%{transform:scale(1.2) rotate(10deg)}
      100%{opacity:1;transform:scale(1) rotate(0deg)}
    }
    @keyframes rp-card-select {
      0%{transform:scale(1)}
      50%{transform:scale(1.15)}
      100%{transform:scale(1.08)}
    }
    @keyframes rp-boss-shake {
      0%,100%{transform:translate(0,0)}
      25%{transform:translate(-6px,2px)}
      75%{transform:translate(6px,-2px)}
    }
    @keyframes rp-reveal-slide {
      0%{opacity:0;transform:translateX(40px)}
      100%{opacity:1;transform:translateX(0)}
    }
    .rp-hotspot { animation: rp-hotspot-pulse 1.5s ease-in-out infinite; }
    .rp-cell-in { animation: rp-matrix-cell-in 0.3s ease-out forwards; }
    .rp-dot-in  { animation: rp-risk-dot-in 0.5s ease-out forwards; }
    .rp-card-selected { animation: rp-card-select 0.25s ease forwards; }
    .rp-boss-shake { animation: rp-boss-shake 0.4s ease-in-out; }
    .rp-reveal-slide { animation: rp-reveal-slide 0.4s ease-out forwards; }
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

function playProbCard()   { playTone(440, 'square', 0.12, 0.09); }
function playImpactCard() { playTone(330, 'sawtooth', 0.12, 0.09); }
function playHydraRoar() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [60, 90, 120].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8 + i * 0.1);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + 0.9 + i * 0.1);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}
function playReveal()    { [440, 554, 659].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.3, 0.12), i * 100)); }
function playApprove()   { [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.15, 0.1), i * 80)); }
function playComplete()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2, 0.12), i * 100)); }

// ─── Helpers ────────────────────────────────────────────────────────────────
function avgRound(vals) {
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function riskColor(prob, impact) {
  const score = prob * impact;
  if (score >= 16) return '#ef4444'; // critical hot spot
  if (score >= 9)  return '#f59e0b'; // elevated
  if (score >= 4)  return '#84cc16'; // medium
  return '#22c55e'; // low
}

function riskLabel(prob, impact) {
  const score = prob * impact;
  if (score >= 16) return 'CRITICAL';
  if (score >= 9)  return 'HIGH';
  if (score >= 4)  return 'MEDIUM';
  return 'LOW';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScaleCard({ value, selected, onSelect, disabled, color }) {
  return (
    <button
      className={selected ? 'rp-card-selected' : ''}
      disabled={disabled}
      onClick={() => { if (!disabled) onSelect(value); }}
      style={{
        fontFamily: PF, fontSize: 12,
        color: selected ? '#0e1019' : '#a0aec0',
        background: selected ? `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` : 'rgba(255,255,255,0.04)',
        border: selected ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        padding: '10px 14px',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 48,
        transition: 'all 0.15s',
      }}
    >
      {value}
    </button>
  );
}

function RiskMatrix({ risks }) {
  const MATRIX_SIZE = 5;
  // Build 5x5 grid — each cell has list of risk ids
  const cells = {};
  risks.forEach(r => {
    if (!r.probability || !r.impact) return;
    const key = `${r.probability}-${r.impact}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(r);
  });

  return (
    <div>
      {/* Y-axis label */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: 7, color: '#64748b', fontFamily: PF, marginRight: 4, paddingBottom: 24 }}>
          PROBABILITY →
        </div>
        <div>
          {/* Grid (prob 5→1, impact 1→5) */}
          <div style={{ display: 'grid', gridTemplateColumns: `24px repeat(${MATRIX_SIZE}, 1fr)`, gridTemplateRows: `repeat(${MATRIX_SIZE}, 1fr)`, gap: 3 }}>
            {/* Y axis labels */}
            {[5, 4, 3, 2, 1].map(p => (
              <div key={`y${p}`} style={{ fontFamily: PF, fontSize: 7, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</div>
            ))}
            {/* Cells */}
            {[5, 4, 3, 2, 1].flatMap(p =>
              [1, 2, 3, 4, 5].map(im => {
                const key = `${p}-${im}`;
                const cellRisks = cells[key] || [];
                const isHot = p >= 4 && im >= 4;
                const isMed = p * im >= 9;
                const bg = isHot
                  ? 'rgba(239,68,68,0.25)'
                  : isMed
                    ? 'rgba(245,158,11,0.15)'
                    : 'rgba(255,255,255,0.03)';
                const borderColor = isHot
                  ? 'rgba(239,68,68,0.5)'
                  : isMed
                    ? 'rgba(245,158,11,0.3)'
                    : 'rgba(255,255,255,0.07)';
                return (
                  <div
                    key={key}
                    className={isHot && cellRisks.length > 0 ? 'rp-hotspot' : ''}
                    style={{
                      width: 52, height: 52,
                      background: bg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 3,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: 2,
                      position: 'relative',
                    }}
                  >
                    {cellRisks.map(r => (
                      <div
                        key={r.id}
                        className="rp-dot-in"
                        title={r.title}
                        style={{
                          width: 12, height: 12,
                          borderRadius: '50%',
                          background: riskColor(p, im),
                          border: '1px solid rgba(255,255,255,0.4)',
                          cursor: 'default',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>
          {/* X-axis labels */}
          <div style={{ display: 'grid', gridTemplateColumns: `24px repeat(${MATRIX_SIZE}, 1fr)`, marginTop: 4 }}>
            <div />
            {[1, 2, 3, 4, 5].map(im => (
              <div key={`x${im}`} style={{ fontFamily: PF, fontSize: 7, color: '#64748b', textAlign: 'center' }}>{im}</div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginLeft: 28, fontSize: 7, color: '#64748b', fontFamily: PF, marginTop: 2 }}>
            IMPACT →
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RiskPokerScreen({ sessionId, user, onBack }) {
  injectRPStyles();
  const [phase, setPhase]           = useState('loading'); // loading | add | voting | reveal | summary
  const [session, setSession]       = useState(null);
  const [risks, setRisks]           = useState([]);
  const [currentRiskIdx, setCurrentRiskIdx] = useState(0);
  const [myVotes, setMyVotes]       = useState({}); // riskId → {prob, impact}
  const [allVotes, setAllVotes]     = useState({}); // riskId → [{user_id, probability, impact}]
  const [revealedRisks, setRevealedRisks] = useState(new Set());
  const [approvedRisks, setApprovedRisks] = useState(new Set());
  const [savedRiskIds, setSavedRiskIds]   = useState({}); // localId → supabaseId
  const [newRiskTitle, setNewRiskTitle]   = useState('');
  const [newRiskDesc, setNewRiskDesc]     = useState('');
  const [bossHp, setBossHp]         = useState(100);
  const [dmgNums, setDmgNums]       = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isGm, setIsGm]             = useState(false);
  const [bossTrigger, setBossTrigger] = useState(false);
  const dmgId = useRef(0);

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

    // Load existing risks for this session
    const { data: existingRisks } = await supabase.from('risks').select('*').eq('session_id', sessionId).order('created_at');
    const localRisks = (existingRisks || []).map((r, i) => ({ ...r, _localId: r.id }));
    setRisks(localRisks);

    // Load votes
    const { data: votes } = await supabase.from('risk_estimates').select('*').eq('session_id', sessionId);
    const grouped = {};
    const myV = {};
    (votes || []).forEach(v => {
      if (!grouped[v.risk_id]) grouped[v.risk_id] = [];
      grouped[v.risk_id].push(v);
      if (v.user_id === user?.id) myV[v.risk_id] = { prob: v.probability, impact: v.impact };
    });
    setAllVotes(grouped);
    setMyVotes(myV);
    setPhase(localRisks.length > 0 ? 'voting' : 'add');
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`risk_poker_${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_estimates', filter: `session_id=eq.${sessionId}` }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const v = payload.new;
          setAllVotes(prev => {
            const cur = prev[v.risk_id] || [];
            const idx = cur.findIndex(x => x.user_id === v.user_id);
            if (idx >= 0) { const u = [...cur]; u[idx] = v; return { ...prev, [v.risk_id]: u }; }
            return { ...prev, [v.risk_id]: [...cur, v] };
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  // ── Add risk ───────────────────────────────────────────────────────────────
  async function addRisk() {
    if (!newRiskTitle.trim()) return;
    // Save to DB immediately
    const { data: saved, error } = await supabase.from('risks').insert({
      session_id: sessionId,
      organization_id: session?.organization_id,
      title: newRiskTitle.trim(),
      description: newRiskDesc.trim() || null,
    }).select().single();
    if (!error && saved) {
      setRisks(prev => [...prev, { ...saved, _localId: saved.id }]);
      playTone(660, 'square', 0.1, 0.1);
    }
    setNewRiskTitle('');
    setNewRiskDesc('');
  }

  // ── Submit vote ────────────────────────────────────────────────────────────
  async function submitVote(riskId, prob, impact) {
    setMyVotes(prev => ({ ...prev, [riskId]: { prob, impact } }));
    if (prob !== undefined) playProbCard(); else playImpactCard();
    // Only upsert when both are set
    const current = myVotes[riskId] || {};
    const finalProb   = prob   !== undefined ? prob   : current.prob;
    const finalImpact = impact !== undefined ? impact : current.impact;
    if (!finalProb || !finalImpact) return;
    await supabase.from('risk_estimates').upsert({
      session_id: sessionId,
      risk_id: riskId,
      user_id: user.id,
      probability: finalProb,
      impact: finalImpact,
    }, { onConflict: 'session_id,risk_id,user_id' });
  }

  // ── Reveal risk ────────────────────────────────────────────────────────────
  function revealRisk(riskId) {
    playReveal();
    setRevealedRisks(prev => new Set([...prev, riskId]));
    const votes = allVotes[riskId] || [];
    const avgProb   = avgRound(votes.map(v => v.probability));
    const avgImpact = avgRound(votes.map(v => v.impact));
    const score = avgProb * avgImpact;
    if (score >= 16) {
      playHydraRoar();
      setBossTrigger(true);
      setTimeout(() => setBossTrigger(false), 500);
      setBossHp(hp => Math.max(0, hp + 15)); // boss gains HP for hot spots
      spawnDmg('🔥 HOT SPOT!', '#ef4444', 280);
    } else if (score >= 9) {
      setBossHp(hp => Math.max(0, hp - 10));
      spawnDmg(`RISK: ${riskLabel(avgProb, avgImpact)}`, '#f59e0b', 280);
    } else {
      setBossHp(hp => Math.max(0, hp - 15));
      spawnDmg(`RISK: ${riskLabel(avgProb, avgImpact)}`, '#22c55e', 280);
    }
  }

  // ── Approve → save scores ──────────────────────────────────────────────────
  async function approveRisk(riskId) {
    if (!isGm) return;
    const votes = allVotes[riskId] || [];
    const avgProb   = avgRound(votes.map(v => v.probability));
    const avgImpact = avgRound(votes.map(v => v.impact));
    const rank = avgProb * avgImpact;
    await supabase.from('risks').update({ probability: avgProb, impact: avgImpact, priority_rank: rank }).eq('id', riskId);
    setApprovedRisks(prev => new Set([...prev, riskId]));
    playApprove();
    spawnDmg('✓ RISK LOGGED', '#22c55e', 200);
  }

  // ── Damage numbers ────────────────────────────────────────────────────────
  function spawnDmg(text, color, x) {
    const id = ++dmgId.current;
    const y = 200 + Math.random() * 80;
    setDmgNums(prev => [...prev, { id, text, color, x, y }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1600);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const currentRisk = risks[currentRiskIdx];
  const currentVotes = currentRisk ? allVotes[currentRisk.id] || [] : [];
  const avgProb   = currentRisk ? avgRound(currentVotes.map(v => v.probability)) : 0;
  const avgImpact = currentRisk ? avgRound(currentVotes.map(v => v.impact)) : 0;
  const isRevealed = currentRisk ? revealedRisks.has(currentRisk.id) : false;
  const myVoteForCurrent = currentRisk ? myVotes[currentRisk.id] : null;

  // Build risk objects with consensus scores for matrix
  const risksWithScores = risks.map(r => {
    const votes = allVotes[r.id] || [];
    const p = votes.length ? avgRound(votes.map(v => v.probability)) : r.probability;
    const im = votes.length ? avgRound(votes.map(v => v.impact)) : r.impact;
    return { ...r, probability: p, impact: im };
  }).filter(r => revealedRisks.has(r.id));

  // Hot spots
  const hotSpots = risksWithScores.filter(r => r.probability >= 4 && r.impact >= 4);

  const C = { bg: '#0c0810', panel: '#120818', text: '#e2e8f0', text2: '#94a3b8', red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: PF, color: C.red }}>
        LOADING RISK POKER...
      </div>
    );
  }

  if (showSummary) {
    return <PostSessionSummary sessionId={sessionId} userId={user?.id} onBack={onBack} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: PF, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.15) 3px,rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Damage numbers */}
      {dmgNums.map(d => <DmgNum key={d.id} text={d.text} color={d.color} x={d.x} y={d.y} />)}

      {/* XP + Sound */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <SoundToggle />
        <GameXPBar userId={user?.id} organizationId={session?.organization_id} />
      </div>
      {user && <XPBadgeNotifier userId={user.id} organizationId={session?.organization_id} />}

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 9, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>← BACK</button>
          <div>
            <div style={{ fontSize: 16, color: C.red, letterSpacing: 2 }}>🎲 RISK POKER</div>
            <div style={{ fontSize: 9, color: C.text2, marginTop: 4 }}>{session?.title || 'Session'}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.text2 }}>RISKS: {risks.length}</div>
            <div style={{ fontSize: 9, color: hotSpots.length > 0 ? C.red : C.green, marginTop: 2 }}>
              HOT SPOTS: {hotSpots.length}
            </div>
          </div>
        </div>

        {/* Boss: The Risk Hydra */}
        <div style={{ marginBottom: 16, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '12px 16px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className={bossTrigger ? 'rp-boss-shake' : ''} style={{ fontSize: '36px' }}>🐉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: C.red, marginBottom: 4 }}>THE RISK HYDRA — HP: {bossHp}/100</div>
              <div style={{ height: 8, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bossHp}%`, background: `linear-gradient(90deg, ${C.red}, #dc2626)`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, color: C.text2 }}>{hotSpots.length} hot spots</div>
              <div style={{ fontSize: 8, color: C.amber, marginTop: 2 }}>feed the hydra</div>
            </div>
          </div>
        </div>

        {/* Phase: Add risks */}
        {phase === 'add' && isGm && (
          <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: C.text2, marginBottom: 12 }}>ADD RISKS TO ASSESS</div>
            <input
              value={newRiskTitle}
              onChange={e => setNewRiskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRisk()}
              placeholder="Risk title..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '8px 12px', color: C.text, fontFamily: VT, fontSize: 16, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <input
              value={newRiskDesc}
              onChange={e => setNewRiskDesc(e.target.value)}
              placeholder="Description (optional)..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '8px 12px', color: C.text, fontFamily: VT, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addRisk} disabled={!newRiskTitle.trim()} style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', opacity: !newRiskTitle.trim() ? 0.5 : 1 }}>
                + ADD RISK
              </button>
              {risks.length > 0 && (
                <button onClick={() => setPhase('voting')} style={{ fontFamily: PF, fontSize: 8, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}>
                  START VOTING →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Phase: Voting + Reveal */}
        {(phase === 'voting' || phase === 'reveal') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Left: Current risk + voting */}
            <div>
              {/* Risk nav */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {risks.map((r, i) => {
                  const approved = approvedRisks.has(r.id);
                  const revealed = revealedRisks.has(r.id);
                  const votes = allVotes[r.id] || [];
                  const avgP = avgRound(votes.map(v => v.probability));
                  const avgI = avgRound(votes.map(v => v.impact));
                  const color = revealed ? riskColor(avgP, avgI) : 'rgba(255,255,255,0.15)';
                  return (
                    <button key={r.id} onClick={() => setCurrentRiskIdx(i)} style={{
                      fontFamily: VT, fontSize: 14,
                      color: i === currentRiskIdx ? '#0e1019' : approved ? C.green : revealed ? color : C.text2,
                      background: i === currentRiskIdx ? '#ef4444' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${i === currentRiskIdx ? C.red : revealed ? color : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 4, padding: '4px 10px', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      R{i + 1}{approved && ' ✓'}
                    </button>
                  );
                })}
                {isGm && (
                  <button onClick={() => setPhase('add')} style={{ fontFamily: VT, fontSize: 12, color: C.text2, background: 'none', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                    + ADD
                  </button>
                )}
              </div>

              {currentRisk && (
                <>
                  <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 6 }}>RISK #{currentRiskIdx + 1}</div>
                    <div style={{ fontFamily: VT, fontSize: 20, color: C.text, marginBottom: 4 }}>{currentRisk.title}</div>
                    {currentRisk.description && (
                      <div style={{ fontFamily: VT, fontSize: 13, color: C.text2 }}>{currentRisk.description}</div>
                    )}
                  </div>

                  {/* Probability vote */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>PROBABILITY (1=VERY LOW → 5=CRITICAL)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {SCALE.map(v => (
                        <ScaleCard
                          key={v}
                          value={v}
                          selected={myVoteForCurrent?.prob === v}
                          onSelect={val => submitVote(currentRisk.id, val, undefined)}
                          disabled={isRevealed}
                          color="#ef4444"
                        />
                      ))}
                    </div>
                    {myVoteForCurrent?.prob && (
                      <div style={{ fontSize: 8, color: C.red, marginTop: 4 }}>
                        → {SCALE_LABELS[myVoteForCurrent.prob]}
                      </div>
                    )}
                  </div>

                  {/* Impact vote */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>IMPACT (1=TRIVIAL → 5=CATASTROPHIC)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {SCALE.map(v => (
                        <ScaleCard
                          key={v}
                          value={v}
                          selected={myVoteForCurrent?.impact === v}
                          onSelect={val => submitVote(currentRisk.id, undefined, val)}
                          disabled={isRevealed}
                          color="#f59e0b"
                        />
                      ))}
                    </div>
                    {myVoteForCurrent?.impact && (
                      <div style={{ fontSize: 8, color: C.amber, marginTop: 4 }}>
                        → {IMPACT_LABELS[myVoteForCurrent.impact]}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 12 }}>
                    VOTES: {currentVotes.length} submitted
                  </div>

                  {/* GM controls */}
                  {isGm && !isRevealed && (
                    <button onClick={() => revealRisk(currentRisk.id)} disabled={currentVotes.length === 0}
                      style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', width: '100%', marginBottom: 8, opacity: currentVotes.length === 0 ? 0.4 : 1 }}>
                      🎲 REVEAL RISK
                    </button>
                  )}
                  {isGm && isRevealed && !approvedRisks.has(currentRisk.id) && (
                    <button onClick={() => approveRisk(currentRisk.id)}
                      style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', width: '100%', marginBottom: 8 }}>
                      ✓ LOG RISK
                    </button>
                  )}

                  {/* Navigation */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {currentRiskIdx > 0 && (
                      <button onClick={() => setCurrentRiskIdx(i => i - 1)} style={{ fontFamily: PF, fontSize: 8, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>← PREV</button>
                    )}
                    {currentRiskIdx < risks.length - 1 ? (
                      <button onClick={() => setCurrentRiskIdx(i => i + 1)} style={{ fontFamily: PF, fontSize: 8, color: C.red, background: 'none', border: `1px solid ${C.red}`, borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>NEXT →</button>
                    ) : (
                      <button onClick={() => { playComplete(); setShowSummary(true); }} style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', flex: 1 }}>FINISH ✓</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: Reveal + Matrix */}
            <div>
              {/* Risk reveal card */}
              {currentRisk && isRevealed && (
                <div className="rp-reveal-slide" style={{ background: C.panel, borderRadius: 6, padding: 20, border: `1px solid ${riskColor(avgProb, avgImpact)}40`, marginBottom: 16 }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 12 }}>RISK ASSESSMENT REVEAL</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ fontSize: 8, color: C.text2, marginBottom: 6 }}>PROBABILITY</div>
                      <div style={{ fontSize: 36, color: C.red, fontFamily: PF }}>{avgProb}</div>
                      <div style={{ fontSize: 9, color: C.red, marginTop: 4 }}>{SCALE_LABELS[avgProb] || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
                      <div style={{ fontSize: 8, color: C.text2, marginBottom: 6 }}>IMPACT</div>
                      <div style={{ fontSize: 36, color: C.amber, fontFamily: PF }}>{avgImpact}</div>
                      <div style={{ fontSize: 9, color: C.amber, marginTop: 4 }}>{IMPACT_LABELS[avgImpact] || '-'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: `${riskColor(avgProb, avgImpact)}20`, borderRadius: 4, border: `1px solid ${riskColor(avgProb, avgImpact)}40` }}>
                    <div style={{ fontSize: 8, color: C.text2, marginBottom: 4 }}>RISK SCORE</div>
                    <div style={{ fontSize: 28, color: riskColor(avgProb, avgImpact), fontFamily: PF }}>{avgProb * avgImpact}</div>
                    <div style={{ fontSize: 10, color: riskColor(avgProb, avgImpact), marginTop: 4 }}>{riskLabel(avgProb, avgImpact)}</div>
                  </div>
                  {avgProb >= 4 && avgImpact >= 4 && (
                    <div className="rp-hotspot" style={{ marginTop: 12, padding: 10, background: 'rgba(239,68,68,0.15)', borderRadius: 4, textAlign: 'center', border: '1px solid rgba(239,68,68,0.4)' }}>
                      <div style={{ fontSize: 9, color: C.red }}>🔥 HOT SPOT — IMMEDIATE ACTION REQUIRED</div>
                    </div>
                  )}
                </div>
              )}

              {/* Risk Matrix */}
              {risksWithScores.length > 0 && (
                <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize: 9, color: C.text2, marginBottom: 12 }}>RISK MATRIX</div>
                  <RiskMatrix risks={risksWithScores} />
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[{ label: 'CRITICAL', color: '#ef4444' }, { label: 'HIGH', color: '#f59e0b' }, { label: 'MEDIUM', color: '#84cc16' }, { label: 'LOW', color: '#22c55e' }].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                        <div style={{ fontSize: 7, color: C.text2, fontFamily: PF }}>{l.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hot spot list */}
              {hotSpots.length > 0 && (
                <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: 12, border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div style={{ fontSize: 8, color: C.red, marginBottom: 8 }}>🔥 HOT SPOTS — PRIORITY RISKS</div>
                  {hotSpots.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontFamily: VT, fontSize: 14, color: C.text }}>{r.title}</div>
                      <div style={{ fontSize: 8, color: C.red }}>P{r.probability}×I{r.impact}={r.probability * r.impact}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
