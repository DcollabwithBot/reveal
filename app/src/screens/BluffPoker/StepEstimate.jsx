import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PF, VT, FIBS } from './bpHelpers.js';

export default function StepEstimate({ participants, item, myVote, onVote, votedCount, timeLeft }) {
  const timerColor = timeLeft < 3 ? 'var(--danger)' : timeLeft < 5 ? 'var(--warn)' : 'var(--gold)';
  const timerAnim = timeLeft === 0 ? 'bp-buzz 0.15s ease-in-out infinite' : timeLeft < 3 ? 'bp-timer-pulse 0.5s ease-in-out infinite' : 'none';

  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--epic)', marginBottom: '8px' }}>ESTIMATE</div>

      {item && (
        <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--text)', marginBottom: '16px' }}>
          {item.title}
        </div>
      )}

      <div style={{
        fontFamily: PF, fontSize: '36px', color: timerColor,
        animation: timerAnim, display: 'inline-block', marginBottom: '20px',
        textShadow: `0 0 12px ${timerColor}`,
      }}>
        {timeLeft}
      </div>

      {!myVote ? (
        <div>
          <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text2)', marginBottom: '12px' }}>
            Pick your estimate:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
            {FIBS.map(n => (
              <button key={n} onClick={() => onVote(n)} style={{
                width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                background: 'var(--bg2)', border: '2px solid var(--border2)',
                color: 'var(--text)', cursor: 'pointer',
                borderBottom: '4px solid var(--border)', borderRight: '4px solid var(--border)',
                transition: 'all 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--epic)'; e.currentTarget.style.color = 'var(--epic)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)'; }}
              >{n}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
            background: 'var(--bg2)', border: '3px solid var(--jade)',
            color: 'var(--jade)', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '8px',
            boxShadow: '0 0 12px var(--jade)',
          }}>{myVote}</div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--jade)' }}>VOTE LOCKED ✓</div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)' }}>
        {votedCount}/{participants.length} voted
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
        {participants.map((p, i) => (
          <div key={p.id} style={{ textAlign: 'center', opacity: p.voted ? 1 : 0.4 }}>
            <Sprite m={p.member} size={1} />
            <div style={{ fontFamily: VT, fontSize: '14px', color: p.voted ? 'var(--jade)' : 'var(--text3)' }}>
              {p.voted ? '✓' : '?'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
