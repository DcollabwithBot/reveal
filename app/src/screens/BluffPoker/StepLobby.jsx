import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import { PixelBtn } from './BpUIPrimitives.jsx';
import { PF, VT } from './bpHelpers.js';

export default function StepLobby({ participants, item, isGM, onStart, onBack }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
        <div style={{ fontFamily: PF, fontSize: '18px', color: 'var(--epic)', letterSpacing: '2px', textShadow: '2px 2px 0 #000' }}>
          BLUFF POKER
        </div>
        <div className="scanlines" style={{ position: 'absolute', inset: 0 }} />
      </div>

      <div style={{
        background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
        borderLeft: '3px solid var(--epic)',
        padding: '10px 14px', marginBottom: '20px', textAlign: 'left',
        fontFamily: VT, fontSize: '18px', color: 'var(--text2)', lineHeight: 1.6,
      }}>
        <span style={{ fontFamily: PF, fontSize: '7px', color: 'var(--epic)', display: 'block', marginBottom: '4px', letterSpacing: 1 }}>
          HVAD LØSER DETTE?
        </span>
        En spiller estimerer bevidst forkert. Find blufferen — og lær at kende dit teams estimeringsmønstre.
      </div>

      {item && (
        <div style={{
          background: 'var(--bg2)', border: '2px solid var(--border2)',
          padding: '12px 16px', marginBottom: '24px', fontFamily: VT, fontSize: '20px',
          color: 'var(--gold)',
        }}>
          <div style={{ fontFamily: PF, fontSize: '8px', color: 'var(--text3)', marginBottom: '6px' }}>ESTIMATING</div>
          {item.title}
        </div>
      )}

      <div style={{ fontFamily: PF, fontSize: '8px', color: 'var(--text3)', marginBottom: '12px' }}>
        PLAYERS ({participants.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
        {participants.map((p, i) => (
          <div key={p.id} className="bp-floating" style={{ animationDelay: `${i * 0.2}s`, textAlign: 'center' }}>
            <Sprite m={p.member} size={1.5} />
            <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)', marginTop: '4px' }}>{p.name}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <PixelBtn onClick={onBack} color="var(--bg3)" style={{ fontSize: '8px' }}>← BACK</PixelBtn>
        {isGM && (
          <PixelBtn onClick={onStart} color="var(--jade)" disabled={!item}>
            START GAME
          </PixelBtn>
        )}
        {!isGM && (
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text3)', alignSelf: 'center' }}>
            Waiting for GM to start...
          </div>
        )}
      </div>
    </div>
  );
}
