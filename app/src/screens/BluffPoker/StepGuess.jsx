import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PixelBtn } from './BpUIPrimitives.jsx';
import { PF, VT } from './bpHelpers.js';

export default function StepGuess({ participants, myGuess, onGuess, guessCount, isGM, onAfsloering, timeLeft, userId }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px', animation: 'bp-suspense-bg 4s ease-in-out infinite' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--danger)', marginBottom: '8px', textShadow: '0 0 8px var(--danger)' }}>
        HVEM BLUFFER?
      </div>

      <div style={{
        fontFamily: PF, fontSize: '24px',
        color: timeLeft < 30 ? 'var(--danger)' : 'var(--warn)',
        marginBottom: '16px',
        animation: timeLeft < 30 ? 'bp-timer-pulse 0.5s ease-in-out infinite' : 'none',
      }}>
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </div>

      {!myGuess ? (
        <div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text2)', marginBottom: '16px' }}>
            Click on the bluffer!
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', marginBottom: '24px' }}>
            {participants.filter(p => p.userId !== userId).map((p, i) => (
              <div key={p.id} onClick={() => onGuess(p.userId)} style={{ textAlign: 'center', cursor: 'pointer' }}
                className="bp-floating" style2={{ animationDelay: `${i * 0.15}s` }}>
                <div style={{
                  border: '3px solid var(--border2)', padding: '8px',
                  transition: 'all 0.15s',
                  background: 'var(--bg2)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.boxShadow = '0 0 16px var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <Sprite m={p.member} size={1.5} />
                </div>
                <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text)', marginTop: '6px' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--jade)', marginBottom: '8px' }}>VOTE LOCKED</div>
          <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--text2)' }}>
            You suspect: <span style={{ color: 'var(--warn)' }}>
              {participants.find(p => p.userId === myGuess)?.name}
            </span>
          </div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)', marginBottom: '16px' }}>
        {guessCount}/{participants.length} have voted
      </div>

      {isGM && (
        <PixelBtn onClick={onAfsloering} color="var(--danger)">
          AFSLØRING!
        </PixelBtn>
      )}
    </div>
  );
}
