import { useState, useEffect } from 'react';
import PostSessionSummary from '../../components/session/PostSessionSummary.jsx';
import AchievementPopup from './AchievementPopup.jsx';
import { playSpeedWinner } from './ssAudio.js';
import { fibStepDelta, avgEstimate, PF, VT } from './ssHelpers.js';
import { fixedScanlines } from '../../shared/styles.js';

export default function StepStats({ items, round1Estimates, round2Estimates, participants, responseTimes, onBack, sessionId }) {
  const [animated, setAnimated] = useState(false);
  const [shownAchievement, setShownAchievement] = useState(null);

  useEffect(() => {
    setTimeout(() => setAnimated(true), 100);
    playSpeedWinner();
  }, []);

  const totalItems = items.length;
  const speedTimeMin = (totalItems * 10) / 60;
  const itemsPerMin = speedTimeMin > 0 ? (totalItems / speedTimeMin).toFixed(1) : '—';

  const accurateCount = items.filter(item => {
    const avg1 = avgEstimate(round1Estimates[item.id] || []);
    const avg2 = avgEstimate(round2Estimates[item.id] || []);
    if (avg1 == null || avg2 == null) return false;
    return fibStepDelta(avg1, avg2) <= 1;
  }).length;
  const accuracyPct = totalItems > 0 ? Math.round((accurateCount / totalItems) * 100) : 0;
  const accuracyColor = accuracyPct >= 70 ? 'var(--jade)' : accuracyPct >= 40 ? 'var(--warn)' : 'var(--danger)';

  const hiddenItems = items.filter(item => {
    const avg1 = avgEstimate(round1Estimates[item.id] || []);
    const avg2 = avgEstimate(round2Estimates[item.id] || []);
    if (avg1 == null || avg2 == null) return false;
    return fibStepDelta(avg1, avg2) >= 2;
  });

  const leaders = participants.map(p => {
    const rt = responseTimes[p.user_id || p.id];
    return { ...p, avgResponseMs: rt ? (rt.reduce((a, b) => a + b, 0) / rt.length) : 9999999 };
  }).sort((a, b) => a.avgResponseMs - b.avgResponseMs);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={fixedScanlines} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: PF, fontSize: 16, color: 'var(--gold)', letterSpacing: 2, marginBottom: 4 }}>📊 VELOCITY STATS</div>
          <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)' }}>Speed round analysis complete</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEMS / MINUTE</div>
            <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 24, color: '#00aaff', animation: animated ? 'ss-countUp 0.6s ease' : 'none' }}>⚡ {itemsPerMin}</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)', marginTop: 4 }}>speed round</div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ACCURACY SCORE</div>
            <div style={{ fontFamily: PF, fontSize: 24, color: accuracyColor, animation: animated ? 'ss-countUp 0.6s ease 0.2s both' : 'none' }}>{accuracyPct}%</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)', marginTop: 4 }}>within ±1 step</div>
          </div>
        </div>

        {hiddenItems.length > 0 && (
          <div style={{ background: 'rgba(232,84,84,0.06)', border: '1px solid var(--danger)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)', marginBottom: 12 }}>🕵️ HIDDEN COMPLEXITY ITEMS</div>
            {hiddenItems.map((item, i) => {
              const avg1 = avgEstimate(round1Estimates[item.id] || []);
              const avg2 = avgEstimate(round2Estimates[item.id] || []);
              const delta = fibStepDelta(avg1, avg2);
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text)' }}>{item.title}</span>
                  <span style={{ fontFamily: PF, fontSize: 8, color: 'var(--danger)' }}>+{delta} step{delta > 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        {leaders.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 12 }}>⚡ SPEED DEMONS</div>
            {leaders.map((p, i) => (
              <div key={p.id || p.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', width: 20 }}>#{i + 1}</span>
                  <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--text)' }}>{p.name || p.display_name || `P${i + 1}`}</span>
                  {i === 0 && <span style={{ fontSize: 18 }}>⚡</span>}
                </div>
                <span style={{ fontFamily: PF, fontSize: 7, color: i === 0 ? '#00aaff' : 'var(--text3)' }}>
                  {p.avgResponseMs < 9999999 ? `${(p.avgResponseMs / 1000).toFixed(1)}s avg` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {accuracyPct === 100 && (
            <div className="ss-pop" style={{ display: 'inline-block', background: 'rgba(184,147,46,0.1)', border: '1px solid var(--gold)', borderRadius: 8, padding: '10px 20px', marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--gold)', display: 'block', marginTop: 4 }}>CALIBRATED UNLOCKED!</span>
            </div>
          )}
          {hiddenItems.length >= 3 && (
            <div className="ss-pop" style={{ display: 'inline-block', background: 'rgba(232,84,84,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 20px', marginLeft: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🕵️</span>
              <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--danger)', display: 'block', marginTop: 4 }}>COMPLEXITY HUNTER!</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={onBack} style={{ fontFamily: PF, fontSize: 8, color: 'var(--text2)', background: 'none', border: '2px solid var(--border2)', padding: '12px 24px', cursor: 'pointer' }}>
            ← BACK TO SESSION
          </button>
        </div>

        <PostSessionSummary sessionType="speed_scope" results={{ hidden_complexity_count: hiddenItems.length, velocity: itemsPerMin }} approvalPending={false} approvalItems={[]} onBack={onBack} sessionId={sessionId} />
      </div>

      {shownAchievement && <AchievementPopup {...shownAchievement} onClose={() => setShownAchievement(null)} />}
    </div>
  );
}
