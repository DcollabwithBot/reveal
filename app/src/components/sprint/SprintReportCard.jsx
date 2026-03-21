import { useState, useEffect, useRef } from 'react';

// ── Press Start 2P font (pixel) ───────────────────────────────────────────────
const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

// ── CSS for staggered reveal & animations ─────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById('sprint-report-card-styles')) return;
  const s = document.createElement('style');
  s.id = 'sprint-report-card-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

    @keyframes src-fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes src-countUp {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes src-scanline {
      0%   { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes src-crown {
      0%   { transform: scale(1) rotate(-5deg); }
      50%  { transform: scale(1.3) rotate(5deg); }
      100% { transform: scale(1) rotate(-5deg); }
    }
    @keyframes src-xpBar {
      from { width: 0%; }
      to   { width: var(--xp-pct); }
    }
    @keyframes src-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    .src-metric-row {
      opacity: 0;
      animation: src-fadeInUp 0.5s ease forwards;
    }
    .src-xp-bar-fill {
      animation: src-xpBar 1.2s ease forwards;
    }
  `;
  document.head.appendChild(s);
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function SprintReportCard({ sprintData, onClose }) {
  useEffect(() => { injectStyles(); }, []);

  const [revealed, setRevealed] = useState(0); // how many metrics revealed so far
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  const {
    sprintName = 'Sprint',
    velocity = 0,
    accuracy = 0,          // 0-100 %
    unplannedRate = 0,      // 0-100 %
    missionCompletions = 0,
    totalXP = 0,
    highlights = [],        // [{ name, role, icon }]
  } = sprintData || {};

  // Metrics to reveal one-by-one
  const metrics = [
    {
      key: 'velocity',
      label: 'VELOCITY',
      value: `${velocity} pts`,
      color: 'var(--jade)',
      icon: '⚡',
    },
    {
      key: 'accuracy',
      label: 'ACCURACY',
      value: `${Math.round(accuracy)}%`,
      color: accuracy >= 80 ? 'var(--jade)' : accuracy >= 60 ? 'var(--gold)' : 'var(--danger)',
      icon: '🎯',
    },
    {
      key: 'unplanned',
      label: 'UNPLANNED WORK',
      value: `${Math.round(unplannedRate)}%`,
      color: unplannedRate <= 10 ? 'var(--jade)' : unplannedRate <= 25 ? 'var(--gold)' : 'var(--danger)',
      icon: '📦',
    },
    {
      key: 'missions',
      label: 'MISSIONS DONE',
      value: `${missionCompletions}`,
      color: 'var(--epic)',
      icon: '🏆',
    },
    {
      key: 'xp',
      label: 'XP EARNED',
      value: `+${totalXP} XP`,
      color: 'var(--gold)',
      icon: '✨',
    },
  ];

  // Staggered reveal
  useEffect(() => {
    if (revealed < metrics.length) {
      timerRef.current = setTimeout(() => setRevealed(r => r + 1), 600);
    } else {
      setDone(true);
    }
    return () => clearTimeout(timerRef.current);
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const xpPct = Math.min(100, (totalXP / 200) * 100);

  return (
    <div style={styles.overlay}>
      {/* Scanline effect */}
      <div style={styles.scanline} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', letterSpacing: 2 }}>
            SPRINT COMPLETE
          </span>
          <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--epic)', marginTop: 8, textShadow: '0 0 12px var(--epic)' }}>
            {sprintName.toUpperCase()}
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Metrics — staggered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
          {metrics.map((m, i) => (
            i < revealed ? (
              <div
                key={m.key}
                className="src-metric-row"
                style={{
                  animationDelay: '0ms',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg3)',
                  border: `1px solid ${m.color}44`,
                  borderRadius: 6,
                }}
              >
                <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)' }}>
                  {m.icon} {m.label}
                </span>
                <span style={{
                  fontFamily: PF,
                  fontSize: 11,
                  color: m.color,
                  textShadow: `0 0 8px ${m.color}`,
                  animation: 'src-countUp 0.4s ease',
                }}>
                  {m.value}
                </span>
              </div>
            ) : (
              <div key={m.key} style={{
                height: 44,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
              }}>
                <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)', animation: 'src-blink 1s step-end infinite' }}>
                  ▓▓▓▓▓▓▓▓
                </span>
              </div>
            )
          ))}
        </div>

        {/* XP bar */}
        {done && (
          <div style={{ margin: '12px 0 16px' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', marginBottom: 6, letterSpacing: 1 }}>
              SPRINT XP PROGRESS
            </div>
            <div style={styles.xpTrack}>
              <div
                className="src-xp-bar-fill"
                style={{
                  '--xp-pct': `${xpPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--gold), var(--epic))',
                  borderRadius: 3,
                  boxShadow: '0 0 8px var(--gold)',
                }}
              />
            </div>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--gold)', marginTop: 4, textAlign: 'right' }}>
              {totalXP} / 200 XP
            </div>
          </div>
        )}

        {/* Per-person highlights */}
        {done && highlights.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', marginBottom: 10, letterSpacing: 2 }}>
              PLAYER HIGHLIGHTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {highlights.map((h, i) => (
                <div key={i} style={styles.highlight}>
                  <span style={{ fontSize: 20 }}>{h.icon}</span>
                  <div>
                    <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text)', marginBottom: 2 }}>{h.name}</div>
                    <div style={{ fontFamily: VT, fontSize: 14, color: 'var(--text2)' }}>{h.role}</div>
                  </div>
                  {i === 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 18, animation: 'src-crown 1.5s ease-in-out infinite' }}>
                      👑
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Close button */}
        {done && (
          <button onClick={onClose} style={styles.closeBtn}>
            CLOSE REPORT
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  scanline: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'var(--bg2)',
    border: '2px solid var(--epic)',
    borderRadius: 12,
    padding: '24px 28px',
    width: 420,
    maxWidth: '95vw',
    boxShadow: '0 0 40px rgba(139,92,246,0.3)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '12px 0',
  },
  xpTrack: {
    height: 10,
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  highlight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 6,
  },
  closeBtn: {
    marginTop: 20,
    width: '100%',
    fontFamily: PF,
    fontSize: 8,
    color: 'var(--bg)',
    background: 'var(--jade)',
    border: 'none',
    borderRadius: 6,
    padding: '12px 0',
    cursor: 'pointer',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
};
