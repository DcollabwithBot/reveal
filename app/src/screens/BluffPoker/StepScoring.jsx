import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PixelBtn, AchievementPopup, Confetti } from './BpUIPrimitives.jsx';
import { PF, VT } from './bpHelpers.js';

export default function StepScoring({ participants, scores, blufferId, achievements, onAchievementClose, onNext }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px', position: 'relative' }}>
      <Confetti />

      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', marginBottom: '20px' }}>
        RESULTS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {participants.map((p, i) => {
          const score = scores[p.userId] || { xp: 0, label: '' };
          const isBluffer = p.userId === blufferId;
          return (
            <div key={p.id} className="bp-reveal-in" style={{
              animationDelay: `${i * 0.2}s`, opacity: 0,
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg2)', border: `2px solid ${score.xp > 0 ? 'var(--jade)' : 'var(--border)'}`,
              padding: '10px 14px',
              boxShadow: score.xp > 0 ? '0 0 12px var(--jade)' : 'none',
            }}>
              <Sprite m={p.member} size={1} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text)' }}>
                  {p.name} {isBluffer ? '🃏' : ''}
                </div>
                <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text3)' }}>{score.label}</div>
              </div>
              {score.xp > 0 && (
                <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', animation: 'bp-winner-burst 0.5s ease-out' }}>
                  +{score.xp} XP
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PixelBtn onClick={onNext} color="var(--jade)">
        RE-VOTE →
      </PixelBtn>

      {achievements.map((a, i) => (
        <AchievementPopup key={i} {...a} onClose={() => onAchievementClose(i)} />
      ))}
    </div>
  );
}
