/**
 * SprintDraft shared UI components:
 * QuickEstimateModal, ConfettiBurst, SprintCelebration, CapacityGauge,
 * TokenAssigner, MysteryCard, DraftItemCard
 */
import { useState, useEffect } from 'react';
import { screenStyles, gaugeStyles, tokenBtnStyle, actionBtn, TSHIRT_MAP, QUICK_ESTIMATE_SECONDS } from './sdConstants.js';

// ── Quick Estimate Modal ──────────────────────────────────────────────────────
export function QuickEstimateModal({ item, onEstimate, onCancel }) {
  const [votes, setVotes] = useState({});
  const [timer, setTimer] = useState(QUICK_ESTIMATE_SECONDS);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (timer <= 0 && !submitted) { handleSubmit(); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleVote(size) { setVotes(prev => ({ ...prev, self: size })); }

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const allVotes = Object.values(votes);
    if (!allVotes.length) { onEstimate(TSHIRT_MAP.M); return; }
    const counts = {};
    allVotes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    onEstimate(TSHIRT_MAP[winner] || 5);
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '2px solid var(--epic)', borderRadius: 'var(--radius)', padding: 24, maxWidth: 400, width: '90%', textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace", marginBottom: 8 }}>QUICK ESTIMATE</p>
        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{item?.title}</p>
        <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Press Start 2P', monospace", color: timer <= 5 ? 'var(--danger)' : 'var(--epic)', animation: timer <= 5 ? 'gaugePulse 0.5s ease-in-out infinite' : 'none', marginBottom: 16 }}>⏱ {timer}s</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {Object.entries(TSHIRT_MAP).map(([size, sp]) => (
            <button key={size} onClick={() => handleVote(size)} style={{ padding: '12px 16px', border: `2px solid ${votes.self === size ? 'var(--epic)' : 'var(--border)'}`, background: votes.self === size ? 'var(--epic-dim)' : 'var(--bg3)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontFamily: "'Press Start 2P', monospace", color: 'var(--text)' }}>
              <div>{size}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{sp} SP</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={handleSubmit} disabled={!votes.self} style={{ ...screenStyles.primaryBtn, padding: '10px 20px', fontSize: 10, opacity: votes.self ? 1 : 0.5 }}>Confirm</button>
          <button onClick={onCancel} style={{ ...screenStyles.secondaryBtn, padding: '10px 20px', fontSize: 10 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── CSS Confetti ──────────────────────────────────────────────────────────────
export function ConfettiBurst({ active }) {
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
        <div key={i} style={{ position: 'absolute', width: 6, height: 6, background: p.color, borderRadius: 2, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, animation: `confettiPop 0.8s ${p.delay}s ease-out forwards` }} />
      ))}
    </div>
  );
}

// ── Sprint Celebration ────────────────────────────────────────────────────────
export function SprintCelebration({ sprintName, capacityPct, participants, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeOverlay 3.5s ease-in-out forwards' }}>
      <div style={{ fontSize: 20, fontFamily: "'Press Start 2P', monospace", color: 'var(--jade)', textShadow: '0 0 30px rgba(0,200,150,0.5)', marginBottom: 16, animation: 'bounceIn 0.6s ease-out' }}>
        SPRINT LOCKED AND LOADED 🚀
      </div>
      {sprintName && <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>{sprintName} · {capacityPct}% filled</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(participants || []).slice(0, 8).map((p, i) => (
          <div key={p.id || i} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--epic-dim)', border: '2px solid var(--epic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text)', fontWeight: 700, animation: `bounceIn 0.4s ${0.1 * i}s ease-out both` }}>
            {(p.display_name || 'A')[0].toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Capacity Gauge ────────────────────────────────────────────────────────────
export function CapacityGauge({ used, total, overflowFlash }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 105) : 0;
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
    <div style={{ ...gaugeStyles.container, animation: overflowFlash ? 'overflowShake 0.5s ease-in-out' : 'none' }}>
      <div style={gaugeStyles.header}>
        <span style={{ color: 'var(--text2)', fontSize: 11, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>CAPACITY {pct >= 100 && <span style={{ animation: 'lockSlam 0.4s ease-out' }}>🔒</span>}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{Math.round(used)} / {total} SP ({Math.round(pct)}%)</span>
      </div>
      <div style={gaugeStyles.track}>
        <div style={{ ...gaugeStyles.fill, width: `${Math.min(pct, 100)}%`, background: color, animation: isWarning ? `gaugePulse ${pulseSpeed} ease-in-out infinite` : 'none' }} />
      </div>
      {showPerfect && <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'var(--jade)', fontFamily: "'Press Start 2P', monospace", animation: 'perfectFill 2s ease-out forwards' }}>🎯 Perfect Fill!</div>}
      {overflowFlash && <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: 'var(--danger)', fontWeight: 700, fontFamily: "'Press Start 2P', monospace" }}>OVERFLOW</div>}
    </div>
  );
}

// ── Token Assigner ────────────────────────────────────────────────────────────
export function TokenAssigner({ tokens, maxTokens, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => onChange(Math.max(0, tokens - 1))} disabled={tokens <= 0} style={tokenBtnStyle}>−</button>
      <span style={{ color: 'var(--epic)', fontWeight: 700, fontSize: 14, minWidth: 18, textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>{tokens}</span>
      <button onClick={() => onChange(Math.min(maxTokens, tokens + 1))} disabled={tokens >= maxTokens} style={tokenBtnStyle}>+</button>
      {Array.from({ length: tokens }).map((_, i) => <span key={i} style={{ color: 'var(--epic)', fontSize: 12 }}>⭐</span>)}
    </div>
  );
}

// ── Mystery Card ──────────────────────────────────────────────────────────────
export function MysteryCard({ item, onFlip }) {
  return (
    <div style={{ padding: '16px', background: '#1a1a2e', border: '2px solid var(--epic-border)', borderRadius: 'var(--radius)', textAlign: 'center', cursor: 'pointer', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 32, color: 'var(--epic)', animation: 'mysteryGlow 2s ease-in-out infinite', marginBottom: 8 }}>?</div>
      <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>{item.title}</p>
      <button onClick={() => onFlip(item)} style={{ padding: '6px 14px', background: 'var(--epic-dim)', border: '1px solid var(--epic)', borderRadius: 'var(--radius)', color: 'var(--epic)', fontSize: 9, fontFamily: "'Press Start 2P', monospace", cursor: 'pointer' }}>
        🃏 Flip Card
      </button>
    </div>
  );
}

// ── Draft Item Card ───────────────────────────────────────────────────────────
export function DraftItemCard({ item, priorityScore, pick, onDraft, onSkip, onPark, capacityLeft, isGM, onOverride, disabled, onFlipMystery, revealAnim }) {
  const estimate = Number(item.final_estimate) || Number(item.estimated_hours) || 0;
  const isMystery = !estimate && !pick;
  const wontFit = estimate > 0 && estimate > capacityLeft && !pick;
  const decision = pick?.decision;

  const borderColor = decision === 'drafted' ? 'var(--jade)' : decision === 'stretch' ? 'var(--gold)' :
    decision === 'skipped' ? 'var(--text3)' : decision === 'parked' ? 'var(--text3)' : 'var(--border)';

  const isSmall = revealAnim === 'small';
  const isBig = revealAnim === 'big';

  if (isMystery && !pick) return <MysteryCard item={item} onFlip={onFlipMystery} />;

  return (
    <div style={{ padding: '12px 16px', background: wontFit ? 'rgba(255,255,255,0.03)' : 'var(--bg2)', border: `2px solid ${borderColor}`, borderRadius: 'var(--radius)', marginBottom: 8, opacity: wontFit ? 0.5 : decision ? 0.85 : 1, transition: 'all 0.3s ease', animation: revealAnim === 'flipping' ? 'cardFlip 0.6s ease-in-out' : isSmall ? 'greenFlash 1.5s ease-out' : isBig ? 'cameraShake 0.8s ease-in-out' : 'none', position: 'relative' }}>
      {(isSmall || isBig) && (
        <div style={{ position: 'absolute', top: -8, right: 12, fontSize: 9, color: isSmall ? 'var(--jade)' : 'var(--danger)', fontFamily: "'Press Start 2P', monospace", fontWeight: 700, animation: 'bounceIn 0.4s ease-out' }}>
          {isSmall ? 'Nice! Small one!' : "Whoa, that's a big one!"}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {item.item_code && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{item.title}</span>
          </div>
          {priorityScore > 0 && <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>⭐ {priorityScore} priority</span>}
        </div>
        <div style={{ padding: '4px 10px', background: estimate ? 'var(--bg3)' : 'var(--danger)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 700, color: estimate ? 'var(--text)' : '#fff', fontFamily: "'Press Start 2P', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
          {estimate || '?'} SP {pick?.estimate_source === 'quick' && <span style={{ fontSize: 8, color: 'var(--warn)' }}>⚠️ rough</span>}
        </div>
      </div>
      {decision && (
        <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 10, fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace", background: decision === 'drafted' ? 'rgba(0,200,150,0.15)' : 'rgba(128,128,128,0.15)', color: decision === 'drafted' ? 'var(--jade)' : 'var(--text3)' }}>
          {decision === 'drafted' ? '✅ DRAFTED' : decision === 'skipped' ? '⏭️ SKIPPED' : decision === 'parked' ? '📦 PARKED' : '🔶 STRETCH'}
          {pick?.pm_override && <span style={{ marginLeft: 6, color: 'var(--gold)' }}>PM OVERRIDE</span>}
        </div>
      )}
      {wontFit && !decision && <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace" }}>⚠️ WON'T FIT</div>}
      {!decision && !disabled && !isMystery && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onDraft} disabled={wontFit} style={{ ...actionBtn, background: wontFit ? 'var(--bg3)' : 'rgba(0,200,150,0.15)', color: wontFit ? 'var(--text3)' : 'var(--jade)', borderColor: wontFit ? 'var(--border)' : 'var(--jade)' }}>✅ Draft</button>
          <button onClick={onSkip} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>⏭️ Skip</button>
          <button onClick={onPark} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>📦 Park</button>
          {isGM && wontFit && <button onClick={onOverride} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>🔓 Override</button>}
        </div>
      )}
    </div>
  );
}
