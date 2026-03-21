import { PixelBtn, Confetti } from './BpUIPrimitives.jsx';
import { PF, VT, FIBS } from './bpHelpers.js';

export default function StepRevote({ item, myRevote, onRevote, isGM, onFinalize, finalEstimate, votedCount, participants, onDone }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--jade)', marginBottom: '8px' }}>
        RE-VOTE
      </div>

      {finalEstimate ? (
        <div className="bp-pop-in" style={{ marginTop: '32px' }}>
          <Confetti />
          <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--text3)', marginBottom: '8px' }}>FINAL ESTIMATE</div>
          <div style={{
            fontFamily: PF, fontSize: '48px', color: 'var(--gold)',
            textShadow: '0 0 24px var(--gold)', animation: 'bp-glow 2s ease-in-out infinite',
          }}>{finalEstimate}</div>
          <div style={{ fontFamily: VT, fontSize: '24px', color: 'var(--text2)', marginTop: '16px' }}>
            🎉 CONSENSUS REACHED!
          </div>
          <button onClick={onDone} style={{
            marginTop: 24, fontFamily: PF, fontSize: 8, padding: '10px 16px',
            background: 'rgba(0,255,136,0.1)', border: '2px solid var(--jade)',
            color: 'var(--jade)', cursor: 'pointer',
          }}>
            SE RESULTAT →
          </button>
        </div>
      ) : (
        <>
          {item && (
            <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text)', marginBottom: '16px' }}>
              {item.title}
            </div>
          )}

          {!myRevote ? (
            <div>
              <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text2)', marginBottom: '12px' }}>
                Your final estimate:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                {FIBS.map(n => (
                  <button key={n} onClick={() => onRevote(n)} style={{
                    width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                    background: 'var(--bg2)', border: '2px solid var(--border2)',
                    color: 'var(--text)', cursor: 'pointer',
                    borderBottom: '4px solid var(--border)', borderRight: '4px solid var(--border)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--jade)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
                  >{n}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                background: 'var(--bg2)', border: '3px solid var(--jade)',
                color: 'var(--jade)', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '8px',
              }}>{myRevote}</div>
              <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--jade)' }}>VOTE LOCKED ✓</div>
            </div>
          )}

          <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)', marginBottom: '16px' }}>
            {votedCount}/{participants.length} voted
          </div>

          {isGM && myRevote && (
            <PixelBtn onClick={onFinalize} color="var(--gold)">
              APPROVE FINAL →
            </PixelBtn>
          )}
        </>
      )}
    </div>
  );
}
