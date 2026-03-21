import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PF, VT } from './bpHelpers.js';

export default function StepAfsloering({ participants, blufferId, guessResults }) {
  const bluffer = participants.find(p => p.userId === blufferId);

  return (
    <div style={{ textAlign: 'center', padding: '16px', position: 'relative' }}>
      {/* Spotlight overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        animation: 'bp-spotlight 1.5s ease-out forwards',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 11 }}>
        <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--danger)', marginBottom: '20px', textShadow: '0 0 16px var(--danger)' }}>
          AFSLØRING!
        </div>

        {bluffer && (
          <div className="bp-pop-in" style={{ marginBottom: '24px' }}>
            <div style={{ animation: 'bp-glow 1.5s ease-in-out infinite', display: 'inline-block', padding: '12px', border: '3px solid var(--epic)' }}>
              <Sprite m={bluffer.member} size={3} />
            </div>
            <div style={{ fontFamily: PF, fontSize: '12px', color: 'var(--epic)', marginTop: '12px', textShadow: '0 0 8px var(--epic)' }}>
              {bluffer.name}
            </div>
            <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--warn)', marginTop: '4px' }}>
              WAS THE BLUFFER!
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
          {participants.filter(p => p.userId !== blufferId).map((p, i) => {
            const correct = guessResults[p.userId];
            return (
              <div key={p.id} className="bp-reveal-in" style={{ textAlign: 'center', animationDelay: `${0.5 + i * 0.15}s`, opacity: 0 }}>
                <Sprite m={p.member} size={1.2} />
                <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)' }}>{p.name}</div>
                <div style={{ fontSize: '24px' }}>{correct ? '✅' : '❌'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
