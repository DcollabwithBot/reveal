import { Sprite } from '../../components/session/SessionPrimitives.jsx';
import MatryoshkaDoll from './MatryoshkaDoll.jsx';
import { PF, VT } from './nsHelpers.js';

export default function StepLobby({ sessionId, user, avatar, participants, item, isGM, onStart }) {
  return (
    <div className="ns-step ns-lobby">
      <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--gold)', textAlign: 'center', lineHeight: 2, marginBottom: 24 }}>
        RUSSIAN<br />NESTING SCOPE
      </div>

      <MatryoshkaDoll itemName={item?.title || '???'} size={1.4} />

      <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text2)', textAlign: 'center', marginTop: 16 }}>
        What hides inside this scope?
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 20 }}>
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Sprite avatar={p.avatar} size={40} />
            <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)' }}>{p.name}</span>
          </div>
        ))}
      </div>

      {isGM && (
        <button className="ns-btn ns-btn-primary" onClick={onStart} style={{ marginTop: 32 }}>
          START BREAKDOWN
        </button>
      )}
      {!isGM && (
        <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text3)', marginTop: 32 }}>
          Waiting for GM to start...
        </div>
      )}
    </div>
  );
}
