/**
 * B5: Perspektiv-Poker Game Mode
 * session_type: 'perspective_poker'
 *
 * 6-step flow:
 *  1. Perspektiv-kort uddeles (skjult)
 *  2. Alle estimerer fra DERES PERSPEKTIV
 *  3. Reveal: votes vises med perspektiv-label
 *  4. Gap-analyse: visuelt spread-diagram
 *  5. Diskussion (2 min timer)
 *  6. Re-vote → final estimate + GM approve
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sprite } from '../components/session/SessionPrimitives.jsx';
import { CLASSES } from '../shared/constants.js';
import { dk } from '../shared/utils.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

const PERSPECTIVES = {
  customer:  { label: 'Customer',   icon: '🛒', color: '#00c896', desc: 'Estimer fra brugerens synspunkt' },
  support:   { label: 'Support',    icon: '🎧', color: '#e8a020', desc: 'Estimer fra supportperspektiv' },
  ops:       { label: 'Operations', icon: '⚙️', color: '#8b5cf6', desc: 'Estimer fra driftsperspektiv' },
  developer: { label: 'Developer',  icon: '💻', color: '#3b82f6', desc: 'Estimer fra udviklerperspektiv' },
  security:  { label: 'Security',   icon: '🔒', color: '#e85454', desc: 'Estimer fra sikkerhedsperspektiv' },
  business:  { label: 'Business',   icon: '📊', color: '#b8932e', desc: 'Estimer fra forretningsperspektiv' },
};

const ESTIMATE_CARDS = [1, 2, 3, 5, 8, 13, 21, '?'];

// ── CSS injection ─────────────────────────────────────────────────────────────
let ppStylesInjected = false;
function injectStyles() {
  if (ppStylesInjected) return;
  ppStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

    @keyframes pp-cardFlip {
      0%   { transform: perspective(800px) rotateY(0deg); }
      49%  { transform: perspective(800px) rotateY(90deg); opacity: 0.5; }
      50%  { transform: perspective(800px) rotateY(-90deg); opacity: 0.5; }
      100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
    }
    @keyframes pp-crown {
      0%, 100% { transform: translateY(0) rotate(-5deg) scale(1); }
      50%       { transform: translateY(-8px) rotate(5deg) scale(1.2); }
    }
    @keyframes pp-dealCard {
      from { opacity: 0; transform: translateY(-40px) scale(0.8); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pp-reveal {
      from { opacity: 0; transform: translateX(-20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes pp-barGrow {
      from { width: 0; }
    }
    @keyframes pp-scanline {
      0%   { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    @keyframes pp-pulse-glow {
      0%, 100% { box-shadow: 0 0 8px currentColor; }
      50%       { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
    }
    @keyframes pp-timer-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    .pp-card-flip { animation: pp-cardFlip 0.6s ease; }
    .pp-deal-in { animation: pp-dealCard 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; opacity: 0; }
    .pp-reveal { animation: pp-reveal 0.4s ease forwards; opacity: 0; }
    .pp-crown-anim { animation: pp-crown 2s ease-in-out infinite; }
    .pp-bar-grow { animation: pp-barGrow 1s ease forwards; }
    .pp-timer-urgent { animation: pp-timer-pulse 0.8s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ── Web Audio ─────────────────────────────────────────────────────────────────
function playCardDeal() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function playReveal() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [261, 329, 392, 523].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'triangle'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function playTick() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 660;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function Timer({ seconds, onExpire, label = '' }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => {
      setLeft(l => l - 1);
      if (left <= 10) playTick();
    }, 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = Math.floor(left / 60);
  const s = left % 60;
  const urgent = left <= 30;

  return (
    <div style={{ display: 'flex', align: 'center', gap: 6, alignItems: 'center' }}>
      {label && <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>{label}</span>}
      <span
        className={urgent ? 'pp-timer-urgent' : ''}
        style={{ fontFamily: PF, fontSize: 11, color: urgent ? 'var(--danger)' : 'var(--jade)' }}
      >
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}

// ── Estimate card ─────────────────────────────────────────────────────────────
function EstimateCard({ value, selected, onClick, disabled }) {
  return (
    <button
      onClick={() => !disabled && onClick(value)}
      disabled={disabled}
      style={{
        fontFamily: PF,
        fontSize: value === '?' ? 14 : 11,
        background: selected ? 'var(--epic)' : 'var(--bg3)',
        color: selected ? 'var(--bg)' : 'var(--text2)',
        border: `2px solid ${selected ? 'var(--epic)' : 'var(--border)'}`,
        borderRadius: 8,
        width: 52,
        height: 68,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: selected ? '0 0 12px var(--epic)' : 'none',
        transition: 'all 0.15s',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {value}
    </button>
  );
}

// ── Perspective card ──────────────────────────────────────────────────────────
function PerspectiveCard({ perspKey, revealed, animate }) {
  const p = PERSPECTIVES[perspKey] || PERSPECTIVES.developer;

  return (
    <div
      className={animate ? 'pp-deal-in' : ''}
      style={{
        background: revealed ? `${p.color}22` : 'var(--bg3)',
        border: `2px solid ${revealed ? p.color : 'var(--border2)'}`,
        borderRadius: 12,
        padding: '18px 20px',
        textAlign: 'center',
        minWidth: 140,
        boxShadow: revealed ? `0 0 16px ${p.color}44` : 'none',
        transition: 'all 0.4s',
      }}
    >
      {revealed ? (
        <>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{p.icon}</div>
          <div style={{ fontFamily: PF, fontSize: 8, color: p.color, marginBottom: 4 }}>
            {p.label.toUpperCase()}
          </div>
          <div style={{ fontFamily: VT, fontSize: 14, color: 'var(--text2)' }}>
            {p.desc}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 36, marginBottom: 8, filter: 'grayscale(1)' }}>🃏</div>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)' }}>
            HIDDEN
          </div>
        </>
      )}
    </div>
  );
}

// ── Gap Analysis Diagram ──────────────────────────────────────────────────────
function GapDiagram({ votes, perspectiveMap }) {
  // Group votes by perspective
  const byPerspective = {};
  votes.forEach(v => {
    const p = perspectiveMap[v.user_id] || 'developer';
    if (!byPerspective[p]) byPerspective[p] = [];
    if (typeof v.estimate === 'number') byPerspective[p].push(v.estimate);
  });

  const entries = Object.entries(byPerspective).filter(([, vals]) => vals.length > 0);
  const allVals = entries.flatMap(([, vals]) => vals);
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const spread = maxVal - minVal;

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', marginBottom: 14, letterSpacing: 2 }}>
        PERSPECTIVE GAP ANALYSIS
      </div>

      {entries.map(([perspKey, vals]) => {
        const p = PERSPECTIVES[perspKey] || PERSPECTIVES.developer;
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const pct = maxVal > 0 ? (avg / maxVal) * 100 : 0;

        return (
          <div key={perspKey} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: VT, fontSize: 18, color: p.color }}>
                {p.icon} {p.label}
              </span>
              <span style={{ fontFamily: PF, fontSize: 9, color: p.color }}>
                {avg.toFixed(1)}
              </span>
            </div>
            <div style={{ height: 14, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div
                className="pp-bar-grow"
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: p.color,
                  borderRadius: 4,
                  boxShadow: `0 0 6px ${p.color}`,
                }}
              />
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>Gap score</span>
        <span style={{
          fontFamily: PF,
          fontSize: 11,
          color: spread >= 5 ? 'var(--danger)' : spread >= 3 ? 'var(--warn)' : 'var(--jade)',
        }}>
          {spread.toFixed(1)} pts
          {spread >= 5 && ' ⚠️'}
          {spread >= 3 && spread < 5 && ' 🔶'}
          {spread < 3 && ' ✅'}
        </span>
      </div>

      {spread >= 3 && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'rgba(232,84,84,0.08)',
          border: '1px solid rgba(232,84,84,0.2)',
          borderRadius: 6,
          fontFamily: VT,
          fontSize: 16,
          color: 'var(--danger)',
        }}>
          ⚠️ Stort perspektiv-gap — diskuter risici!
        </div>
      )}
    </div>
  );
}

// ── Pixel art avatar helpers ──────────────────────────────────────────────────
function makeAnonMember(index) {
  const cl = CLASSES[index % CLASSES.length];
  return {
    id: index,
    name: `ANON ${index + 1}`,
    lv: 1 + (index % 5),
    cls: cl,
    hat: cl.color,
    body: cl.color,
    skin: ['#fdd', '#fed', '#edc', '#ffe', '#fec'][index % 5],
    isP: false,
  };
}

function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return {
    id: 0,
    name: 'YOU',
    lv: 3,
    cls: cl,
    hat: avatar?.helmet?.pv || cl.color,
    body: avatar?.armor?.pv || cl.color,
    skin: avatar?.skin || '#fdd',
    isP: true,
  };
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PerspectivePokerScreen({ sessionId, user, avatar, onBack }) {
  useEffect(() => { injectStyles(); }, []);

  const [phase, setPhase] = useState('loading');
  // loading | deal | estimate | reveal | gap | discuss | revote | done
  const [items, setItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [myPerspective, setMyPerspective] = useState(null);
  const [perspectiveMap, setPerspectiveMap] = useState({});
  const [myEstimate, setMyEstimate] = useState(null);
  const [myRevote, setMyRevote] = useState(null);
  const [allVotes, setAllVotes] = useState([]);
  const [allRevotes, setAllRevotes] = useState([]);
  const [isGM, setIsGM] = useState(false);
  const [finalData, setFinalData] = useState(null);
  const channelRef = useRef(null);

  const PERSPECTIVES_KEYS = Object.keys(PERSPECTIVES);

  useEffect(() => {
    loadSession();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSession() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sess) return;
    setIsGM(sess.created_by === user.id);

    const { data: its } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setItems(its || []);

    subscribeRealtime();
    setPhase('deal');
    dealPerspectives(its || [], sess);
  }

  async function dealPerspectives(its, sess) {
    if (!its.length) return;
    const item = its[0];
    // Check if already assigned
    const { data: existing } = await supabase
      .from('perspective_assignments')
      .select('user_id, perspective')
      .eq('session_id', sessionId)
      .eq('session_item_id', item.id);

    if (existing?.length) {
      const pm = {};
      existing.forEach(a => { pm[a.user_id] = a.perspective; });
      setPerspectiveMap(pm);
      setMyPerspective(pm[user.id]);
      playCardDeal();
    } else {
      // GM assigns perspectives (demo: based on user_id hash)
      if (sess?.created_by === user.id || true) {
        const myPersp = PERSPECTIVES_KEYS[Math.floor(Math.random() * PERSPECTIVES_KEYS.length)];
        await supabase.from('perspective_assignments').upsert({
          session_id: sessionId,
          session_item_id: item.id,
          user_id: user.id,
          perspective: myPersp,
        }, { onConflict: 'session_id,session_item_id,user_id' });
        setMyPerspective(myPersp);
        const pm = { [user.id]: myPersp };
        setPerspectiveMap(pm);
        playCardDeal();
      }
    }
  }

  function subscribeRealtime() {
    channelRef.current = supabase
      .channel(`perspective-poker-${sessionId}`)
      .on('broadcast', { event: 'phase' }, ({ payload }) => {
        setPhase(payload.phase);
        if (payload.phase === 'reveal') {
          playReveal();
          if (payload.votes) setAllVotes(payload.votes);
          if (payload.perspMap) setPerspectiveMap(payload.perspMap);
        }
        if (payload.phase === 'next') {
          setCurrentIdx(i => i + 1);
          setPhase('deal');
          setMyEstimate(null);
          setMyRevote(null);
          setAllVotes([]);
          setAllRevotes([]);
        }
        if (payload.phase === 'done') setPhase('done');
        if (payload.phase === 'discuss') {}
        if (payload.phase === 'gap') {}
      })
      .subscribe();
  }

  async function broadcastPhase(payload) {
    await channelRef.current?.send({ type: 'broadcast', event: 'phase', payload });
  }

  async function submitEstimate() {
    if (myEstimate === null) return;
    const item = items[currentIdx];
    await supabase.from('votes').upsert({
      session_id: sessionId,
      session_item_id: item?.id,
      user_id: user.id,
      estimate: typeof myEstimate === 'number' ? myEstimate : null,
    }, { onConflict: 'session_id,session_item_id,user_id' });
  }

  async function gmTriggerReveal() {
    const item = items[currentIdx];
    // Load all votes
    const { data: votes } = await supabase
      .from('votes')
      .select('user_id, estimate')
      .eq('session_id', sessionId)
      .eq('session_item_id', item?.id);

    // Load perspective map
    const { data: assigns } = await supabase
      .from('perspective_assignments')
      .select('user_id, perspective')
      .eq('session_id', sessionId)
      .eq('session_item_id', item?.id);

    const pm = {};
    (assigns || []).forEach(a => { pm[a.user_id] = a.perspective; });
    setPerspectiveMap(pm);
    setAllVotes(votes || []);

    setPhase('reveal');
    broadcastPhase({ phase: 'reveal', votes: votes || [], perspMap: pm });
    setTimeout(() => {
      setPhase('gap');
      broadcastPhase({ phase: 'gap' });
    }, 2000);
  }

  async function gmStartDiscuss() {
    setPhase('discuss');
    broadcastPhase({ phase: 'discuss' });
  }

  async function submitRevote() {
    if (myRevote === null) return;
    const item = items[currentIdx];
    setAllRevotes(prev => {
      const filtered = prev.filter(r => r.user_id !== user.id);
      return [...filtered, { user_id: user.id, estimate: typeof myRevote === 'number' ? myRevote : 0 }];
    });
  }

  async function gmFinalize() {
    const item = items[currentIdx];
    const { data: tokenData } = await supabase.auth.getSession();
    const token = tokenData?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/finalize-perspective`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        sessionId,
        itemId: item?.id,
        revotes: allRevotes,
      }),
    });
    const data = await res.json();
    setFinalData(data);

    if (currentIdx + 1 >= items.length) {
      setPhase('done');
      broadcastPhase({ phase: 'done' });
    } else {
      broadcastPhase({ phase: 'next' });
      setCurrentIdx(i => i + 1);
      setPhase('deal');
      setMyEstimate(null);
      setMyRevote(null);
      setAllVotes([]);
      setAllRevotes([]);
    }
  }

  const currentItem = items[currentIdx];
  const myPerspData = PERSPECTIVES[myPerspective] || PERSPECTIVES.developer;

  if (phase === 'loading') {
    return (
      <div style={styles.container}>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--epic)', textAlign: 'center', marginTop: 80 }}>
          Loading Perspektiv-Poker...
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', marginTop: 80, padding: 24 }}>
          <div style={{ fontSize: 60 }}>🌐</div>
          <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--jade)', margin: '16px 0 8px' }}>
            PERSPEKTIV-POKER DONE
          </div>
          <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 20 }}>
            Alle items estimeret fra alle perspektiver.
          </div>
          {finalData?.risk_notes && (
            <div style={{
              background: 'rgba(232,84,84,0.08)',
              border: '1px solid rgba(232,84,84,0.2)',
              borderRadius: 8,
              padding: '12px 16px',
              fontFamily: VT,
              fontSize: 16,
              color: 'var(--danger)',
              whiteSpace: 'pre-line',
              marginBottom: 20,
              textAlign: 'left',
            }}>
              {finalData.risk_notes}
            </div>
          )}
          <button onClick={onBack} style={styles.primaryBtn}>← BACK TO SESSION</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Scanlines */}
      <div style={styles.scanlines} />

      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← BACK</button>
        <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--epic)', textShadow: '0 0 8px var(--epic)' }}>
          🌐 PERSPEKTIV-POKER
        </div>
        <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>
          {currentIdx + 1}/{items.length}
        </div>
      </div>

      <div style={styles.content}>
        {/* Current item */}
        {currentItem && (
          <div style={styles.itemCard}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', marginBottom: 6, letterSpacing: 2 }}>
              ITEM
            </div>
            <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text)' }}>{currentItem.title}</div>
            {currentItem.description && (
              <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>
                {currentItem.description}
              </div>
            )}
          </div>
        )}

        {/* Phase: Deal — show perspective card */}
        {phase === 'deal' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', letterSpacing: 2 }}>
              YOUR PERSPECTIVE
            </div>
            <Sprite m={makeMyMember(avatar)} size={1.4} idle />
            {myPerspective && (
              <PerspectiveCard perspKey={myPerspective} revealed animate />
            )}
            <div style={{
              fontFamily: VT,
              fontSize: 18,
              color: 'var(--text2)',
              textAlign: 'center',
              maxWidth: 280,
            }}>
              Estimer dette item fra <strong style={{ color: myPerspData.color }}>{myPerspData.label}</strong>-perspektivet
            </div>
            <button
              onClick={() => { setPhase('estimate'); broadcastPhase({ phase: 'estimate' }); }}
              style={styles.primaryBtn}
            >
              START ESTIMERING ▶
            </button>
          </div>
        )}

        {/* Phase: Estimate */}
        {phase === 'estimate' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: PF, fontSize: 7, color: myPerspData.color, letterSpacing: 1 }}>
                {myPerspData.icon} ESTIMER SOM {myPerspData.label.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {ESTIMATE_CARDS.map(v => (
                <EstimateCard
                  key={v}
                  value={v}
                  selected={myEstimate === v}
                  onClick={setMyEstimate}
                />
              ))}
            </div>
            {myEstimate !== null ? (
              <button onClick={submitEstimate} style={styles.primaryBtn}>
                SUBMIT {myEstimate} →
              </button>
            ) : (
              <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text3)', textAlign: 'center' }}>
                Vælg et kort...
              </div>
            )}
            {isGM && (
              <button onClick={gmTriggerReveal} style={{ ...styles.gmBtn, marginTop: 12 }}>
                GM: REVEAL ALLE VOTES ▶
              </button>
            )}
          </div>
        )}

        {/* Phase: Reveal */}
        {phase === 'reveal' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--epic)', textAlign: 'center', marginBottom: 16 }}>
              ✦ REVEAL ✦
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allVotes.map((v, i) => {
                const pk = perspectiveMap[v.user_id] || 'developer';
                const p = PERSPECTIVES[pk] || PERSPECTIVES.developer;
                const isMe = v.user_id === user.id;
                const member = isMe ? makeMyMember(avatar) : makeAnonMember(i);
                return (
                  <div
                    key={v.user_id}
                    className="pp-reveal"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: `${p.color}11`,
                      border: `1px solid ${p.color}44`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                      <Sprite m={member} size={0.85} idle />
                      <span style={{ fontFamily: VT, fontSize: 20, color: p.color }}>
                        {p.icon} {p.label}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: PF,
                      fontSize: 14,
                      color: p.color,
                      textShadow: `0 0 8px ${p.color}`,
                    }}>
                      {v.estimate ?? '?'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase: Gap analysis */}
        {phase === 'gap' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GapDiagram votes={allVotes} perspectiveMap={perspectiveMap} />
            {isGM && (
              <button onClick={gmStartDiscuss} style={styles.primaryBtn}>
                START DISKUSSION ▶
              </button>
            )}
          </div>
        )}

        {/* Phase: Discuss */}
        {phase === 'discuss' && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--gold)', marginBottom: 16 }}>
              DISKUSSION
            </div>
            <Timer seconds={120} label="Tid tilbage:" onExpire={() => { setPhase('revote'); broadcastPhase({ phase: 'revote' }); }} />
            <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginTop: 12 }}>
              Diskuter perspektiv-gaps med dit team!
            </div>
            <GapDiagram votes={allVotes} perspectiveMap={perspectiveMap} />
            {isGM && (
              <button
                onClick={() => { setPhase('revote'); broadcastPhase({ phase: 'revote' }); }}
                style={{ ...styles.gmBtn, marginTop: 16 }}
              >
                GM: START REVOTE ▶
              </button>
            )}
          </div>
        )}

        {/* Phase: Re-vote */}
        {phase === 'revote' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--jade)', marginBottom: 12, textAlign: 'center' }}>
              RE-VOTE — FINAL ESTIMATE
            </div>
            <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginBottom: 12, textAlign: 'center' }}>
              Stem fra dit {myPerspData.label}-perspektiv
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {ESTIMATE_CARDS.map(v => (
                <EstimateCard
                  key={v}
                  value={v}
                  selected={myRevote === v}
                  onClick={setMyRevote}
                />
              ))}
            </div>
            {myRevote !== null && (
              <button onClick={submitRevote} style={styles.primaryBtn}>
                SUBMIT REVOTE {myRevote} →
              </button>
            )}
            {isGM && (
              <button onClick={gmFinalize} style={{ ...styles.gmBtn, marginTop: 12 }}>
                GM: FINALISER → NÆSTE ITEM ▶
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg2)',
    position: 'relative',
    zIndex: 2,
  },
  content: {
    flex: 1,
    padding: '20px',
    position: 'relative',
    zIndex: 1,
    maxWidth: 620,
    margin: '0 auto',
    width: '100%',
  },
  itemCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--epic)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
    boxShadow: '0 0 12px var(--epic-dim)',
  },
  primaryBtn: {
    fontFamily: PF,
    fontSize: 8,
    color: 'var(--bg)',
    background: 'var(--jade)',
    border: 'none',
    borderRadius: 6,
    padding: '12px 0',
    cursor: 'pointer',
    letterSpacing: 1,
    width: '100%',
    textTransform: 'uppercase',
  },
  gmBtn: {
    fontFamily: PF,
    fontSize: 7,
    color: 'var(--bg)',
    background: 'var(--epic)',
    border: 'none',
    borderRadius: 6,
    padding: '10px 0',
    cursor: 'pointer',
    letterSpacing: 1,
    width: '100%',
    boxShadow: '0 0 10px var(--epic)',
  },
  backBtn: {
    fontFamily: PF,
    fontSize: 7,
    color: 'var(--text3)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 10px',
    cursor: 'pointer',
  },
};
