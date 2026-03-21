import CountdownTimer from './CountdownTimer.jsx';
import FibCard from './FibCard.jsx';
import { PF, VT, FIBONACCI } from './ssHelpers.js';
import { fixedScanlines } from '../../shared/styles.js';

export default function StepDiscuss({ items, currentItemIndex, onVote, votedItems, mySpeedEstimates, isGM, participantCount, voteCount, showSpeedVotes, allRound1, onGMAdvance, onToggleShowSpeed }) {
  const item = items[currentItemIndex];
  const myVote = votedItems[item?.id];
  const mySpeed = mySpeedEstimates[item?.id];

  if (!item) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={fixedScanlines} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--jade)', letterSpacing: 2 }}>💬 DISCUSS ROUND</div>
            <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>Discuss first, then vote!</div>
          </div>
          <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)' }}>{currentItemIndex + 1}/{items.length}</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <CountdownTimer seconds={120} onExpire={() => isGM && onGMAdvance()} />
        </div>

        <div style={{ background: 'var(--bg2)', border: '2px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>ITEM</div>
          <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)' }}>{item.title}</div>
        </div>

        {mySpeed && (
          <div style={{ textAlign: 'center', marginBottom: 16, fontFamily: VT, fontSize: 20, color: '#00aaff' }}>
            Your Speed Estimate: <span style={{ fontFamily: PF, fontSize: 14 }}>{mySpeed}</span>
          </div>
        )}

        {isGM && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button onClick={onToggleShowSpeed} style={{ fontFamily: PF, fontSize: 7, color: 'var(--text2)', background: 'none', border: '1px solid var(--border2)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
              {showSpeedVotes ? 'HIDE SPEED VOTES' : 'REVEAL SPEED VOTES'}
            </button>
          </div>
        )}

        {showSpeedVotes && allRound1[item.id] && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {allRound1[item.id].map((v, i) => (
              <div key={i} style={{ background: 'var(--bg3)', border: '2px solid #00aaff44', borderRadius: 6, padding: '8px 12px', fontFamily: PF, fontSize: 12, color: '#00aaff' }}>{v}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {FIBONACCI.map(f => (
            <FibCard key={f} value={f} selected={myVote === f} onClick={() => !myVote && onVote(item.id, f)} disabled={!!myVote} />
          ))}
        </div>

        <div style={{ textAlign: 'center', fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
          {voteCount}/{participantCount} voted
        </div>

        {myVote && (
          <div className="ss-reveal" style={{ textAlign: 'center', fontFamily: VT, fontSize: 22, color: 'var(--jade)', marginBottom: 16 }}>
            Discussed vote: <span style={{ fontFamily: PF, fontSize: 16, color: 'var(--jade)' }}>{myVote}</span>
          </div>
        )}

        {isGM && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={onGMAdvance} style={{ fontFamily: PF, fontSize: 9, color: 'var(--bg)', background: 'var(--jade)', border: '3px solid var(--jade)', borderBottom: '5px solid var(--bg)', padding: '10px 20px', cursor: 'pointer' }}>
              {voteCount === participantCount ? 'NEXT ITEM →' : 'SKIP / NEXT →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
