import { useEffect } from 'react';
import { playReveal } from './ssAudio.js';
import { fibStepDelta, avgEstimate, PF, VT } from './ssHelpers.js';

export default function StepDelta({ items, round1Estimates, round2Estimates, onContinue, onApplyEstimates, isGM }) {
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {deltas.map(({ item, avg1, avg2, delta, hiddenComplexity }, i) => (
            <div key={item.id} className="ss-reveal" style={{ background: 'var(--bg2)', border: hiddenComplexity ? '2px solid var(--danger)' : '1px solid var(--border2)', borderRadius: 8, padding: '12px 16px', animation: `ss-reveal 0.4s ease ${i * 0.08}s both`, boxShadow: hiddenComplexity ? '0 0 12px rgba(232,84,84,0.2)' : 'none' }}>
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
                  <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 4, padding: '6px 10px', whiteSpace: 'nowrap', animation: 'ss-delta-badge 2s ease-in-out infinite' }}>
                    🕵️ HIDDEN<br/>COMPLEXITY
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

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
