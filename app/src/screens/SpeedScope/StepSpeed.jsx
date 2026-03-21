import { useRef, useEffect } from 'react';
import CountdownTimer from './CountdownTimer.jsx';
import FibCard from './FibCard.jsx';
import { PF, VT, FIBONACCI } from './ssHelpers.js';
import { fixedScanlines } from '../../shared/styles.js';

export default function StepSpeed({ items, currentItemIndex, onVote, votedItems, isGM, participantCount, voteCount, onGMAdvance }) {
  const item = items[currentItemIndex];
  const myVote = votedItems[item?.id];
  const itemStartTime = useRef(Date.now());

  useEffect(() => { itemStartTime.current = Date.now(); }, [currentItemIndex]);

  if (!item) return null;

  function handleVote(val) {
    if (myVote) return;
    const responseTime = Date.now() - itemStartTime.current;
    onVote(item.id, val, responseTime);
  }

  return (
    <div className={!myVote ? 'ss-edge-danger' : ''} style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden', padding: '24px 20px' }}>
      <div style={fixedScanlines} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 14, color: '#00aaff', letterSpacing: 2 }}>⚡ SPEED ROUND</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--danger)', marginTop: 4 }}>NO DISCUSSION!</div>
          </div>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)' }}>{currentItemIndex + 1}/{items.length}</div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEM TO ESTIMATE</div>
          <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)' }}>{item.title}</div>
          {item.description && <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginTop: 6 }}>{item.description}</div>}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {!myVote ? (
            <CountdownTimer seconds={10} onExpire={() => { if (!myVote) onVote(item.id, null, 10000); }} />
          ) : (
            <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--jade)' }}>LOCKED IN ✓</div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
          {voteCount}/{participantCount} estimated
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {FIBONACCI.map(f => (
            <FibCard key={f} value={f} selected={myVote === f} onClick={() => handleVote(f)} disabled={!!myVote} />
          ))}
        </div>

        {myVote && (
          <div className="ss-reveal" style={{ textAlign: 'center', fontFamily: VT, fontSize: 22, color: 'var(--jade)', padding: 16, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8 }}>
            You estimated: <span style={{ fontFamily: PF, fontSize: 18, color: 'var(--jade)' }}>{myVote}</span>
          </div>
        )}

        {isGM && voteCount === participantCount && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={onGMAdvance} style={{ fontFamily: PF, fontSize: 9, color: 'var(--bg)', background: '#00aaff', border: '3px solid #00aaff', borderBottom: '5px solid #0077bb', padding: '12px 24px', cursor: 'pointer' }}>
              NEXT ITEM →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
