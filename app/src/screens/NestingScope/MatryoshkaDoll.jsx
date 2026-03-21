import { VT } from './nsHelpers.js';

export default function MatryoshkaDoll({ itemName, size = 1, topRef, bottomRef, opening = false }) {
  const s = size;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* TOP HALF */}
      <div
        ref={topRef}
        className={opening ? 'ns-doll-top-opening' : ''}
        style={{
          width: 120 * s, height: 80 * s,
          borderRadius: `50% 50% 0 0 / 60% 60% 0 0`,
          background: `linear-gradient(180deg, #cc2200 0%, #dd4411 70%, #cc2200 100%)`,
          border: `${3 * s}px solid #991100`,
          borderBottom: 'none',
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: 'hidden',
          transformOrigin: 'bottom center',
          zIndex: 2,
        }}
      >
        {/* Head */}
        <div style={{
          width: 60 * s, height: 50 * s, marginTop: 6 * s,
          background: '#fdd', borderRadius: '50%',
          border: `${2 * s}px solid #cc9977`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4 * s,
          position: 'relative',
        }}>
          {/* Eyes */}
          <div style={{ display: 'flex', gap: 10 * s, marginTop: -4 * s }}>
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: '#222' }} />
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: '#222' }} />
          </div>
          {/* Smile */}
          <div style={{
            width: 20 * s, height: 10 * s,
            borderRadius: `0 0 ${10 * s}px ${10 * s}px`,
            border: `${2 * s}px solid #c44`,
            borderTop: 'none',
            marginTop: -2 * s,
          }} />
        </div>
        {/* Flower decorations */}
        {[20, 40, 70, 90].map((left, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: 8 * s, left: left * s / 1.2,
            width: 8 * s, height: 8 * s, borderRadius: '50%',
            background: i % 2 === 0 ? '#feae34' : '#4caf50',
            border: `${1 * s}px solid rgba(0,0,0,0.3)`,
          }} />
        ))}
      </div>

      {/* YELLOW BAND */}
      <div style={{
        width: 120 * s, height: 24 * s,
        background: '#feae34',
        borderTop: `${2 * s}px solid #cc8800`,
        borderBottom: `${2 * s}px solid #cc8800`,
        borderLeft: `${3 * s}px solid #991100`,
        borderRight: `${3 * s}px solid #991100`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3,
      }}>
        {itemName && (
          <span style={{ fontFamily: VT, fontSize: 12 * s, color: '#222', textAlign: 'center', padding: `0 ${4 * s}px`, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 110 * s }}>
            {itemName}
          </span>
        )}
      </div>

      {/* BOTTOM HALF */}
      <div
        ref={bottomRef}
        className={opening ? 'ns-doll-bottom-opening' : ''}
        style={{
          width: 120 * s, height: 60 * s,
          borderRadius: `0 0 45% 45% / 0 0 40% 40%`,
          background: `linear-gradient(180deg, #cc2200 0%, #dd4411 50%, #cc2200 100%)`,
          border: `${3 * s}px solid #991100`,
          borderTop: 'none',
          transformOrigin: 'top center',
          zIndex: 1,
        }}
      />
    </div>
  );
}
