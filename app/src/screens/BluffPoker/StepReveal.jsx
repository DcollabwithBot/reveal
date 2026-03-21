import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PixelBtn } from './BpUIPrimitives.jsx';
import { PF, VT } from './bpHelpers.js';

export default function StepReveal({ participants, allVotes, blufferId, onNext, showButton }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', marginBottom: '20px' }}>
        VOTES REVEALED
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
        {participants.map((p, i) => {
          const vote = allVotes[p.userId];
          const isBluffer = p.userId === blufferId;
          return (
            <div key={p.id} className="bp-reveal-in"
              style={{ textAlign: 'center', animationDelay: `${i * 0.15}s`, opacity: 0 }}>
              <Sprite m={p.member} size={1.3} />
              <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)', margin: '4px 0' }}>{p.name}</div>
              <div className="bp-card-flip" style={{
                width: '48px', height: '64px', margin: '0 auto',
                background: isBluffer ? 'linear-gradient(135deg, var(--bg2), var(--bg3))' : 'var(--bg2)',
                border: `2px solid ${isBluffer ? 'var(--epic)' : 'var(--border2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: PF, fontSize: isBluffer ? '18px' : '14px',
                color: isBluffer ? 'var(--epic)' : 'var(--text)',
                backgroundSize: isBluffer ? '200% auto' : undefined,
                animation: isBluffer ? 'bp-shimmer 2s linear infinite' : 'bp-cardFlip 0.6s ease-in-out',
                backgroundImage: isBluffer
                  ? 'linear-gradient(90deg, var(--bg2) 0%, var(--epic) 50%, var(--bg2) 100%)'
                  : undefined,
              }}>
                {isBluffer ? '?' : (vote ?? '?')}
              </div>
            </div>
          );
        })}
      </div>

      {showButton && (
        <PixelBtn onClick={onNext} color="var(--danger)" style={{ fontSize: '9px' }}>
          WHO IS THE BLUFFER? →
        </PixelBtn>
      )}
    </div>
  );
}
