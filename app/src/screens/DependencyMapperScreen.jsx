import { handleSoftError } from "../lib/errorHandler";

/**
 * Dependency Mapper — Visual sprint dependency mapping for Scrum
 * session_type: dependency_mapper
 *
 * Flow:
 *   lobby → map_phase → reveal → conflict_vote → resolution → done
 *
 * DNA:
 *  - Alle stemmer tæller — ingen kan sidde stille
 *  - PM-data er source of truth — write-back kræver GM approval
 *  - Gør usikkerhed synlig (konflikter og cirkulære deps)
 *  - Feedback loop (HistoricalContext + PostSessionSummary)
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchRawParticipants, fetchSessionWithItems } from '../lib/sessionHelpers.js';
import { DmgNum } from '../components/session/SessionPrimitives.jsx';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const MAP_DURATION = 300; // 5 min

// ─── Style injection ─────────────────────────────────────────────────────────
let dmStylesInjected = false;
function injectDMStyles() {
  if (dmStylesInjected) return;
  dmStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes dm-spider-idle {
      0%,100% { transform: scale(1) translateY(0); }
      50%      { transform: scale(1.06) translateY(-4px); }
    }
    @keyframes dm-spider-rage {
      0%,100% { transform: scale(1); filter: brightness(1.5); }
      50%      { transform: scale(1.12); filter: brightness(2) hue-rotate(30deg); }
    }
    @keyframes dm-spider-shake {
      0%,100% { transform: translateX(0); }
      25%     { transform: translateX(-8px); }
      75%     { transform: translateX(8px); }
    }
    @keyframes dm-node-pop {
      0%   { opacity:0; transform: scale(0); }
      70%  { transform: scale(1.15); }
      100% { opacity:1; transform: scale(1); }
    }
    @keyframes dm-circular-flash {
      0%,100% { opacity:1; }
      50%     { opacity:0.2; }
    }
    @keyframes dm-reveal-in {
      0%   { opacity:0; transform: translateY(20px); }
      100% { opacity:1; transform: translateY(0); }
    }
    @keyframes dm-shake-screen {
      0%,100% { transform: translate(0,0); }
      20%     { transform: translate(-6px, 3px); }
      40%     { transform: translate(6px, -3px); }
      60%     { transform: translate(-3px, 6px); }
      80%     { transform: translate(3px, -3px); }
    }
    @keyframes dm-xp-float {
      0%   { opacity:0; transform: translateY(0); }
      30%  { opacity:1; transform: translateY(-20px); }
      100% { opacity:0; transform: translateY(-60px); }
    }
    .dm-spider-idle   { animation: dm-spider-idle 2s ease-in-out infinite; }
    .dm-spider-rage   { animation: dm-spider-rage 0.8s ease-in-out infinite; }
    .dm-spider-shake  { animation: dm-spider-shake 0.4s ease-in-out 3; }
    .dm-node-pop      { animation: dm-node-pop 0.4s ease-out forwards; }
    .dm-circular      { animation: dm-circular-flash 0.6s ease-in-out infinite; }
    .dm-reveal-in     { animation: dm-reveal-in 0.4s ease-out forwards; }
    .dm-shake         { animation: dm-shake-screen 0.6s ease-in-out; }
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

function playDepSelect()   { playTone(440, 'square', 0.1, 0.08); }
function playCircularBuzz() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.value = 80 - i * 10;
      const t = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    }
    setTimeout(() => ctx.close(), 900);
  } catch (e) { handleSoftError(e, 'audio-init'); }
}
function playVoteClick()   { playTone(550, 'square', 0.1, 0.07); }
function playApprove()     { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2, 0.1), i * 80)); }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Detect circular dependency A→B→A using DFS
 * deps: { itemId → [blocksItemId] }
 */
function findCircularDeps(deps) {
  const circular = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(node, path) {
    if (stack.has(node)) {
      // Found cycle — extract the cycle
      const cycleStart = path.indexOf(node);
      circular.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const next of (deps[node] || [])) {
      dfs(next, [...path, next]);
    }
    stack.delete(node);
  }

  Object.keys(deps).forEach(node => {
    visited.clear();
    dfs(node, [node]);
  });

  return circular;
}

/**
 * Find top 3 most controversial deps:
 * those with most votes AND most non-voters relative to total participants
 */
function findControversial(depVotes, participantCount) {
  return Object.entries(depVotes)
    .map(([key, userIds]) => {
      const support = userIds.length;
      const oppose = participantCount - support;
      const controversy = Math.min(support, oppose); // equal split = most controversial
      return { key, support, oppose, controversy };
    })
    .sort((a, b) => b.controversy - a.controversy)
    .slice(0, 3);
}

// ─── SVG Dependency Network ───────────────────────────────────────────────────
function DependencyNetwork({ items, confirmedDeps, circularKeys, width = 500, height = 300 }) {
  if (!items.length) return null;

  // Layout items in a circle
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 50;
  const nodeR = 20;

  const positions = items.map((item, i) => {
    const angle = (i / items.length) * 2 * Math.PI - Math.PI / 2;
    return {
      id: item.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      title: item.title?.slice(0, 12) + (item.title?.length > 12 ? '…' : ''),
    };
  });

  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p; });

  // Build edges from confirmed deps: { fromId: [toId, ...] }
  const edges = [];
  Object.entries(confirmedDeps).forEach(([fromId, toIds]) => {
    toIds.forEach(toId => {
      if (posMap[fromId] && posMap[toId]) {
        const key = `${fromId}→${toId}`;
        const isCircular = circularKeys.some(cycle => {
          const idx = cycle.indexOf(fromId);
          return idx >= 0 && cycle[(idx + 1) % cycle.length] === toId;
        });
        edges.push({ fromId, toId, key, isCircular });
      }
    });
  });

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
        </marker>
        <marker id="arrow-circular" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map(e => {
        const from = posMap[e.fromId];
        const to = posMap[e.toId];
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;
        const x1 = from.x + ux * nodeR;
        const y1 = from.y + uy * nodeR;
        const x2 = to.x - ux * (nodeR + 8);
        const y2 = to.y - uy * (nodeR + 8);
        return (
          <line
            key={e.key}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={e.isCircular ? '#ef4444' : '#7c3aed'}
            strokeWidth={e.isCircular ? 2.5 : 1.5}
            strokeDasharray={e.isCircular ? '5,3' : 'none'}
            markerEnd={e.isCircular ? 'url(#arrow-circular)' : 'url(#arrow)'}
            opacity={0.7}
            className={e.isCircular ? 'dm-circular' : ''}
          />
        );
      })}

      {/* Nodes */}
      {positions.map(p => (
        <g key={p.id} className="dm-node-pop">
          <circle cx={p.x} cy={p.y} r={nodeR} fill="#14102a" stroke="#7c3aed" strokeWidth={1.5} />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={9} fill="#e2e8f0" fontFamily={VT}>
            {p.title}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Spider Boss ──────────────────────────────────────────────────────────────
function SpiderBoss({ hp, maxHp = 100, shaking, raging }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <div className={shaking ? 'dm-spider-shake' : raging ? 'dm-spider-rage' : 'dm-spider-idle'} style={{ fontSize: '64px', lineHeight: 1.1 }}>🕷️</div>
      <div style={{ fontFamily: PF, fontSize: 7, color: '#94a3b8', letterSpacing: 1, marginTop: 6 }}>THE DEPENDENCY WEB</div>
      <div style={{ marginTop: 8, padding: '0 16px' }}>
        <div style={{ fontFamily: PF, fontSize: 7, color: '#94a3b8', marginBottom: 4 }}>HP: {hp}/{maxHp}</div>
        <div style={{ height: 10, background: '#1a1c2e', borderRadius: 2, overflow: 'hidden', border: '1px solid #4c1d95' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #7c3aed, #5b21b6)`, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DependencyMapperScreen({ sessionId, user, onBack }) {
  injectDMStyles();

  const [phase, setPhase]               = useState('loading');
  // lobby | map_phase | reveal | conflict_vote | resolution | done
  const [session, setSession]           = useState(null);
  const [items, setItems]               = useState([]);
  const [mapTimer, setMapTimer]         = useState(MAP_DURATION);
  const [myDeps, setMyDeps]             = useState({}); // fromItemId → [toItemId]
  const [allDeps, setAllDeps]           = useState({}); // "fromId→toId" → [user_id]
  const [conflictVotes, setConflictVotes] = useState({}); // "fromId→toId" → {yes:[uid], no:[uid]}
  const [myConflictVotes, setMyConflictVotes] = useState({}); // "key" → 'yes'|'no'
  const [confirmedDeps, setConfirmedDeps] = useState({}); // fromId → [toId]
  const [circularDeps, setCircularDeps] = useState([]); // [[id,id,...], ...]
  const [participants, setParticipants] = useState([]);
  const [isGm, setIsGm]                 = useState(false);
  const [bossHp, setBossHp]             = useState(100);
  const [bossShaking, setBossShaking]   = useState(false);
  const [bossRaging, setBossRaging]     = useState(false);
  const [dmgNums, setDmgNums]           = useState([]);
  const [showSummary, setShowSummary]   = useState(false);
  const [shakeScreen, setShakeScreen]   = useState(false);
  const [savedDeps, setSavedDeps]       = useState(0);
  const [circularCount, setCircularCount] = useState(0);
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

    const parts = await fetchRawParticipants(sessionId);
    setParticipants(parts);

    // Load existing dep submissions
    const { data: existing } = await supabase.from('dependency_submissions').select('*').eq('session_id', sessionId);
    if (existing && existing.length > 0) {
      const grouped = {};
      existing.forEach(d => {
        const key = `${d.from_item_id}→${d.to_item_id}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d.user_id);
      });
      setAllDeps(grouped);
    }

    setPhase('lobby');
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`dependency_mapper_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dependency_submissions', filter: `session_id=eq.${sessionId}` }, payload => {
        const d = payload.new;
        const key = `${d.from_item_id}→${d.to_item_id}`;
        setAllDeps(prev => ({ ...prev, [key]: [...(prev[key] || []), d.user_id] }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dependency_conflict_votes', filter: `session_id=eq.${sessionId}` }, payload => {
        const v = payload.new;
        setConflictVotes(prev => {
          const cur = prev[v.dep_key] || { yes: [], no: [] };
          const side = v.vote === 'yes' ? 'yes' : 'no';
          if (cur[side].includes(v.user_id)) return prev;
          return { ...prev, [v.dep_key]: { ...cur, [side]: [...cur[side], v.user_id] } };
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  // ── Map phase timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'map_phase') return;
    setMapTimer(MAP_DURATION);
    timerRef.current = setInterval(() => {
      setMapTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          moveToReveal();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line

  // ── Toggle my dependency ───────────────────────────────────────────────────
  async function toggleDep(fromId, toId) {
    if (fromId === toId) return;
    const key = `${fromId}→${toId}`;
    const myDepList = myDeps[fromId] || [];
    const alreadySet = myDepList.includes(toId);

    if (!alreadySet) {
      // Check max 3 per person per from-item
      const myTotalDeps = Object.values(myDeps).flat().length;
      if (myTotalDeps >= 9) { // 3 deps × 3 items max total — generøs grænse
        spawnDmg('MAX DEPS NÅET', '#f59e0b', 50);
        return;
      }
      setMyDeps(prev => ({ ...prev, [fromId]: [...(prev[fromId] || []), toId] }));
      playDepSelect();
      await supabase.from('dependency_submissions').insert({ session_id: sessionId, user_id: user.id, from_item_id: fromId, to_item_id: toId });
    } else {
      setMyDeps(prev => ({ ...prev, [fromId]: (prev[fromId] || []).filter(id => id !== toId) }));
      // Remove from DB
      await supabase.from('dependency_submissions').delete()
        .eq('session_id', sessionId).eq('user_id', user.id).eq('from_item_id', fromId).eq('to_item_id', toId);
    }
  }

  // ── Move to reveal ─────────────────────────────────────────────────────────
  function moveToReveal() {
    clearInterval(timerRef.current);
    // Build consensus dep graph (deps mentioned by ≥1 person)
    const depsGraph = {};
    Object.entries(allDeps).forEach(([key, userIds]) => {
      if (userIds.length >= 1) {
        const [from, to] = key.split('→');
        if (!depsGraph[from]) depsGraph[from] = [];
        if (!depsGraph[from].includes(to)) depsGraph[from].push(to);
      }
    });

    // Detect circular deps
    const circles = findCircularDeps(depsGraph);
    setCircularDeps(circles);
    setCircularCount(circles.length);

    if (circles.length > 0) {
      setBossRaging(true);
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 700);
      playCircularBuzz();
      spawnDmg(`⚠️ ${circles.length} CIRCULAR DEPS!`, '#ef4444', 40);
      setBossHp(hp => Math.min(100, hp + circles.length * 15));
    } else {
      spawnDmg('NO CIRCULAR DEPS ✓', '#22c55e', 40);
      setBossHp(hp => Math.max(0, hp - 20));
    }
    setPhase('reveal');
  }

  // ── Vote on dependency conflict ────────────────────────────────────────────
  async function voteConflict(depKey, vote) {
    if (myConflictVotes[depKey]) return;
    setMyConflictVotes(prev => ({ ...prev, [depKey]: vote }));
    playVoteClick();
    await supabase.from('dependency_conflict_votes').insert({ session_id: sessionId, user_id: user.id, dep_key: depKey, vote });
  }

  // ── GM resolve and save confirmed deps ────────────────────────────────────
  async function resolveAndSave() {
    if (!isGm) return;
    const confirmed = {};
    let savedCount = 0;

    // Get deps that survived voting (majority yes)
    for (const [key, userIds] of Object.entries(allDeps)) {
      const votes = conflictVotes[key] || { yes: [], no: [] };
      const totalVoters = participants.length;
      // If controversial (top-3), require majority yes to pass
      const controversial = findControversial(allDeps, participants.length).map(c => c.key);
      if (controversial.includes(key)) {
        if (votes.yes.length <= votes.no.length) continue; // rejected
      }

      const [from, to] = key.split('→');
      // Check not circular
      const testGraph = { ...confirmed };
      if (!testGraph[from]) testGraph[from] = [];
      testGraph[from].push(to);
      const circles = findCircularDeps(testGraph);
      if (circles.length > 0) {
        spawnDmg('⚠️ CIRCULAR REJECTED', '#ef4444', 50);
        continue;
      }

      if (!confirmed[from]) confirmed[from] = [];
      confirmed[from].push(to);
      // Write to item_dependencies table
      await supabase.from('item_dependencies').insert({
        session_id: sessionId,
        from_item_id: from,
        to_item_id: to,
        confirmed_by: user.id,
      }).select().maybeSingle();
      savedCount++;
    }

    setConfirmedDeps(confirmed);
    setSavedDeps(savedCount);
    setBossHp(hp => Math.max(0, hp - savedCount * 10));
    setBossShaking(true);
    setTimeout(() => setBossShaking(false), 500);
    setBossRaging(false);
    playApprove();
    spawnDmg(`${savedCount} DEPS SAVED ✓`, '#22c55e', 50);
    setPhase('done');
  }

  // ── Damage numbers ────────────────────────────────────────────────────────
  function spawnDmg(text, color, xPct) {
    const id = ++dmgId.current;
    setDmgNums(prev => [...prev, { id, text, color, x: xPct, y: 180 + Math.random() * 60 }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1800);
  }

  // ── Colors + constants ────────────────────────────────────────────────────
  const C = {
    bg: '#080b18', panel: '#0d1120', text: '#e2e8f0', text2: '#94a3b8',
    purple: '#7c3aed', gold: '#f59e0b', green: '#22c55e', red: '#ef4444',
  };

  // Computed
  const totalDeps = Object.values(allDeps).reduce((s, ids) => s + ids.length, 0);
  const controversialDeps = findControversial(allDeps, participants.length || 1);

  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: PF, color: C.purple }}>LOADING DEPENDENCY MAPPER...</div>;
  }

  if (showSummary) {
    return (
      <PostSessionSummary
        sessionId={sessionId}
        sessionType="dependency_mapper"
        results={{
          deps_confirmed: savedDeps,
          circular_count: circularCount,
          total_mapped: totalDeps,
        }}
        approvalPending={false}
        teamId={session?.world_id || session?.organization_id}
        onBack={onBack}
      />
    );
  }

  // Build dep graph for network visualization
  const depGraphForViz = {};
  Object.entries(allDeps).forEach(([key, userIds]) => {
    if (userIds.length >= 1) {
      const [from, to] = key.split('→');
      if (!depGraphForViz[from]) depGraphForViz[from] = [];
      if (!depGraphForViz[from].includes(to)) depGraphForViz[from].push(to);
    }
  });

  // Circular dep keys for highlighting
  const circularEdgeKeys = circularDeps.flatMap(cycle =>
    cycle.map((id, i) => `${id}→${cycle[(i + 1) % cycle.length]}`)
  );

  return (
    <div className={shakeScreen ? 'dm-shake' : ''} style={{ minHeight: '100vh', background: C.bg, fontFamily: PF, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.13) 3px,rgba(0,0,0,0.13) 4px)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Damage numbers */}
      {dmgNums.map(d => (
        <div key={d.id} style={{ position: 'fixed', left: `${d.x}%`, top: `${d.y}px`, fontFamily: PF, fontSize: 10, color: d.color, textShadow: `0 0 8px ${d.color}`, pointerEvents: 'none', zIndex: 50, animation: 'dm-xp-float 1.6s ease-out forwards' }}>
          {d.text}
        </div>
      ))}

      {/* HUD */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 100, display: 'flex', gap: 8 }}>
        <SoundToggle />
        <GameXPBar userId={user?.id} organizationId={session?.organization_id} />
      </div>
      {user && <XPBadgeNotifier userId={user.id} organizationId={session?.organization_id} />}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 9, color: C.text2, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>← BACK</button>
          <div>
            <div style={{ fontSize: 14, color: C.purple, letterSpacing: 2 }}>🕸️ DEPENDENCY MAPPER</div>
            <div style={{ fontSize: 8, color: C.text2, marginTop: 3 }}>{session?.title || 'Session'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            {totalDeps > 0 && <div style={{ fontFamily: PF, fontSize: 8, color: C.purple }}>{totalDeps} deps mapped</div>}
            {circularDeps.length > 0 && <div style={{ fontFamily: PF, fontSize: 8, color: C.red }}>⚠️ {circularDeps.length} circular</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>

          {/* Left: Boss + phases */}
          <div>
            <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(124,58,237,0.25)', marginBottom: 12 }}>
              <SpiderBoss hp={bossHp} shaking={bossShaking} raging={bossRaging} />
            </div>

            {/* Phase tracker */}
            <div style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 6, padding: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 7, color: C.text2, marginBottom: 8 }}>PHASE</div>
              {['lobby','map_phase','reveal','conflict_vote','resolution','done'].map(p => {
                const phases = ['lobby','map_phase','reveal','conflict_vote','resolution','done'];
                const cur = phases.indexOf(phase);
                const idx = phases.indexOf(p);
                const done = idx < cur;
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
          </div>

          {/* Right: Main */}
          <div>

            {/* ── LOBBY ─────────────────────────────────────────── */}
            {phase === 'lobby' && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 28, border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize: 12, color: C.purple, marginBottom: 16 }}>HVAD ER DEPENDENCY MAPPER?</div>
                <div style={{ fontFamily: VT, fontSize: 17, color: C.text2, lineHeight: 1.8, marginBottom: 24 }}>
                  🕸️ Alle kortlægger dependencies individuelt (5 min).<br />
                  📊 Reveal viser dependency-netværk med konflikter.<br />
                  ⚠️ Cirkulære dependencies opdages automatisk.<br />
                  🗳️ Team voter på kontroversielle dependencies.<br />
                  ✅ Bekræftede dependencies → gemt til PM.<br /><br />
                  <span style={{ color: C.gold }}>🎯 Formål: Gør skjulte blokkere synlige. Tvinger alle til at tænke på tværs.</span>
                </div>

                {/* Preview: Sprint items */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 8, color: C.text2, marginBottom: 8 }}>SPRINT ITEMS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.slice(0, 8).map(it => (
                      <div key={it.id} style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: '4px 10px', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <span style={{ fontFamily: VT, fontSize: 14, color: C.text }}>{it.title?.slice(0, 20)}</span>
                      </div>
                    ))}
                    {items.length > 8 && <div style={{ fontFamily: VT, fontSize: 14, color: C.text2 }}>+{items.length - 8} mere</div>}
                  </div>
                </div>

                {isGm ? (
                  <button
                    onClick={() => setPhase('map_phase')}
                    disabled={items.length < 2}
                    style={{ fontFamily: PF, fontSize: 10, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '14px 28px', cursor: 'pointer', opacity: items.length < 2 ? 0.5 : 1 }}
                  >
                    🕸️ START DEPENDENCY MAPPING
                  </button>
                ) : (
                  <div style={{ fontFamily: PF, fontSize: 8, color: C.text2 }}>WAITING FOR GAME MASTER...</div>
                )}
              </div>
            )}

            {/* ── MAP PHASE ─────────────────────────────────────── */}
            {phase === 'map_phase' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.purple }}>🗺️ MAP YOUR DEPENDENCIES</div>
                  <div style={{ fontSize: 22, color: mapTimer <= 60 ? C.red : C.gold, fontFamily: PF }}>
                    {formatTime(mapTimer)}
                  </div>
                </div>
                <div style={{ fontFamily: VT, fontSize: 15, color: C.text2, marginBottom: 16 }}>
                  Hvilke items blokerer hvilke? Marker "X blokerer Y" for hvert item. Max 3 dependencies per item.
                </div>

                {items.map(fromItem => {
                  const myDepsForItem = myDeps[fromItem.id] || [];
                  return (
                    <div key={fromItem.id} style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(124,58,237,0.15)', marginBottom: 10 }}>
                      <div style={{ fontFamily: VT, fontSize: 17, color: C.gold, marginBottom: 10 }}>
                        "{fromItem.title?.slice(0, 40)}" blokerer:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {items
                          .filter(it => it.id !== fromItem.id)
                          .map(toItem => {
                            const selected = myDepsForItem.includes(toItem.id);
                            const totalVotes = (allDeps[`${fromItem.id}→${toItem.id}`] || []).length;
                            return (
                              <button
                                key={toItem.id}
                                onClick={() => toggleDep(fromItem.id, toItem.id)}
                                style={{
                                  fontFamily: VT, fontSize: 14,
                                  color: selected ? '#0e1019' : C.text2,
                                  background: selected ? C.purple : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${selected ? C.purple : 'rgba(255,255,255,0.1)'}`,
                                  borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                                  transition: 'all 0.15s', position: 'relative',
                                }}
                              >
                                {toItem.title?.slice(0, 16)}
                                {totalVotes > 0 && (
                                  <span style={{ marginLeft: 4, fontSize: 11, color: selected ? '#0e1019cc' : C.purple }}>
                                    ({totalVotes})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: PF, fontSize: 8, color: C.text2 }}>
                    Dine deps: {Object.values(myDeps).flat().length}
                  </div>
                  {isGm && (
                    <button
                      onClick={() => moveToReveal()}
                      style={{ fontFamily: PF, fontSize: 8, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}
                    >
                      REVEAL NOW →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── REVEAL ────────────────────────────────────────── */}
            {phase === 'reveal' && (
              <div className="dm-reveal-in">
                <div style={{ fontSize: 11, color: C.purple, marginBottom: 16 }}>📊 DEPENDENCY NETWORK</div>

                {/* SVG Network */}
                {items.length > 0 && (
                  <div style={{ background: C.panel, borderRadius: 6, padding: 16, border: '1px solid rgba(124,58,237,0.2)', marginBottom: 16, overflow: 'auto' }}>
                    <DependencyNetwork
                      items={items}
                      confirmedDeps={depGraphForViz}
                      circularKeys={circularDeps}
                      width={Math.min(600, items.length * 80 + 100)}
                      height={320}
                    />
                  </div>
                )}

                {/* Circular dependency warnings */}
                {circularDeps.length > 0 && (
                  <div className="dm-circular" style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 16, border: '2px solid rgba(239,68,68,0.5)', marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: C.red, marginBottom: 10 }}>⚠️ CIRCULAR DEPENDENCIES DETECTED!</div>
                    {circularDeps.map((cycle, i) => {
                      const names = cycle.map(id => items.find(it => it.id === id)?.title?.slice(0, 16) || id);
                      return (
                        <div key={i} style={{ fontFamily: VT, fontSize: 15, color: C.red, marginBottom: 4 }}>
                          🔄 {names.join(' → ')} → {names[0]}
                        </div>
                      );
                    })}
                    <div style={{ fontFamily: VT, fontSize: 13, color: '#fca5a5', marginTop: 8 }}>
                      Cirkulære dependencies gemmes IKKE. De skal løses i teamet.
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{ background: C.panel, borderRadius: 4, padding: 12, border: '1px solid rgba(124,58,237,0.15)', marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: PF, fontSize: 18, color: C.purple }}>{totalDeps}</div>
                      <div style={{ fontSize: 7, color: C.text2, fontFamily: PF, marginTop: 4 }}>total deps</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: PF, fontSize: 18, color: C.red }}>{circularDeps.length}</div>
                      <div style={{ fontSize: 7, color: C.text2, fontFamily: PF, marginTop: 4 }}>circular</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: PF, fontSize: 18, color: C.gold }}>{controversialDeps.length}</div>
                      <div style={{ fontSize: 7, color: C.text2, fontFamily: PF, marginTop: 4 }}>controversies</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setPhase('conflict_vote')}
                  style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer' }}
                >
                  CONFLICT VOTE →
                </button>
              </div>
            )}

            {/* ── CONFLICT VOTE ─────────────────────────────────── */}
            {phase === 'conflict_vote' && (
              <div>
                <div style={{ fontSize: 11, color: C.gold, marginBottom: 8 }}>🗳️ CONFLICT VOTE</div>
                <div style={{ fontFamily: VT, fontSize: 15, color: C.text2, marginBottom: 20 }}>
                  Top-3 mest kontroversielle dependencies. Er de reelle?
                </div>

                {controversialDeps.length === 0 && (
                  <div style={{ background: C.panel, borderRadius: 6, padding: 20, border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontFamily: VT, fontSize: 18, color: C.green }}>Ingen kontroversielle dependencies — alle er enige!</div>
                  </div>
                )}

                {controversialDeps.map(({ key, support, oppose }) => {
                  const [fromId, toId] = key.split('→');
                  const fromItem = items.find(it => it.id === fromId);
                  const toItem = items.find(it => it.id === toId);
                  const votes = conflictVotes[key] || { yes: [], no: [] };
                  const myVote = myConflictVotes[key];
                  const isCircular = circularEdgeKeys.includes(key);
                  return (
                    <div key={key} style={{ background: C.panel, borderRadius: 6, padding: 16, border: `1px solid ${isCircular ? 'rgba(239,68,68,0.4)' : 'rgba(124,58,237,0.2)'}`, marginBottom: 12 }}>
                      <div style={{ fontFamily: VT, fontSize: 18, color: C.text, marginBottom: 8 }}>
                        <span style={{ color: C.gold }}>"{fromItem?.title?.slice(0, 20)}"</span>
                        {' blokerer '}
                        <span style={{ color: C.purple }}>"{toItem?.title?.slice(0, 20)}"</span>
                      </div>
                      <div style={{ fontSize: 7, color: C.text2, marginBottom: 12, fontFamily: PF }}>
                        {support} enige · {oppose} uenige · {isCircular ? '⚠️ CIRCULAR!' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => voteConflict(key, 'yes')}
                          disabled={!!myVote || isCircular}
                          style={{ fontFamily: PF, fontSize: 8, color: myVote === 'yes' ? '#0e1019' : C.green, background: myVote === 'yes' ? C.green : 'none', border: `1px solid ${C.green}`, borderRadius: 3, padding: '6px 14px', cursor: (myVote || isCircular) ? 'default' : 'pointer', opacity: isCircular ? 0.4 : 1 }}
                        >
                          ✓ JA, REEL ({votes.yes.length})
                        </button>
                        <button
                          onClick={() => voteConflict(key, 'no')}
                          disabled={!!myVote || isCircular}
                          style={{ fontFamily: PF, fontSize: 8, color: myVote === 'no' ? '#0e1019' : C.red, background: myVote === 'no' ? C.red : 'none', border: `1px solid ${C.red}`, borderRadius: 3, padding: '6px 14px', cursor: (myVote || isCircular) ? 'default' : 'pointer', opacity: isCircular ? 0.4 : 1 }}
                        >
                          ✗ NEJ, IKKE REEL ({votes.no.length})
                        </button>
                        {isCircular && (
                          <div style={{ fontFamily: VT, fontSize: 14, color: C.red, alignSelf: 'center' }}>⚠️ CIRCULAR — gemmes ikke</div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isGm && (
                  <button
                    onClick={() => setPhase('resolution')}
                    style={{ marginTop: 12, fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer' }}
                  >
                    RESOLVE & SAVE →
                  </button>
                )}
              </div>
            )}

            {/* ── RESOLUTION ────────────────────────────────────── */}
            {phase === 'resolution' && (
              <div style={{ background: C.panel, borderRadius: 6, padding: 24, border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ fontSize: 10, color: C.green, marginBottom: 16 }}>⚡ RESOLUTION</div>
                <div style={{ fontFamily: VT, fontSize: 17, color: C.text2, lineHeight: 1.8, marginBottom: 20 }}>
                  GM godkender — bekræftede dependencies skrives til item_dependencies.<br />
                  Cirkulære dependencies afvises automatisk.<br />
                  Blocker badges opdateres i kanban.
                </div>

                {isGm && (
                  <button
                    onClick={resolveAndSave}
                    style={{ fontFamily: PF, fontSize: 10, color: '#0e1019', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 4, padding: '14px 28px', cursor: 'pointer', width: '100%' }}
                  >
                    ✓ GEM DEPENDENCIES → PM
                  </button>
                )}
                {!isGm && (
                  <div style={{ fontFamily: PF, fontSize: 8, color: C.text2 }}>WAITING FOR GAME MASTER TO SAVE...</div>
                )}
              </div>
            )}

            {/* ── DONE ──────────────────────────────────────────── */}
            {phase === 'done' && (
              <div className="dm-reveal-in" style={{ background: C.panel, borderRadius: 6, padding: 32, border: '2px solid #7c3aed', textAlign: 'center' }}>
                <div style={{ fontSize: '72px', marginBottom: 16 }}>🕸️</div>
                <div style={{ fontSize: 14, color: C.purple, marginBottom: 8 }}>DEPENDENCY MAP SAVED!</div>
                <div style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: 16, marginBottom: 20, border: '1px solid rgba(124,58,237,0.3)' }}>
                  <div style={{ fontFamily: VT, fontSize: 18, color: C.text, lineHeight: 2 }}>
                    ✓ {savedDeps} dependencies gemt til PM<br />
                    ✓ {circularDeps.length} cirkulære dependencies afvist<br />
                    ✓ Blocker badges opdateres automatisk
                  </div>
                </div>
                {circularDeps.length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: 12, border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
                    <div style={{ fontFamily: VT, fontSize: 15, color: C.red }}>
                      ⚠️ {circularDeps.length} cirkulære dependencies kræver manuelt arbejde i teamet.
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 22, color: C.gold, fontFamily: PF, marginBottom: 20 }}>+XP 🕸️</div>
                <button
                  onClick={() => setShowSummary(true)}
                  style={{ fontFamily: PF, fontSize: 9, color: '#0e1019', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer' }}
                >
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
