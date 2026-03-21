import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import MatryoshkaDoll from './MatryoshkaDoll.jsx';
import { playDing, playDollOpen } from './nsAudio.js';
import { PF, VT, TSHIRT_POINTS } from './nsHelpers.js';

export default function StepSumReveal({ sessionId, mergedItems, allEstimates, item, isGM, onDone }) {
  const [opened, setOpened] = useState(false);
  const [settledItems, setSettledItems] = useState([]);
  const [total, setTotal] = useState(0);
  const topRef = useRef();
  const bottomRef = useRef();

  const getTopSize = (estimates) => {
    if (!estimates) return null;
    const counts = {};
    Object.values(estimates.votes || {}).forEach(sz => { counts[sz] = (counts[sz] || 0) + 1; });
    return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, [null, 0])[0];
  };

  const handleOpen = async () => {
    if (opened) return;
    setOpened(true);
    playDollOpen();

    if (isGM) {
      await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'DOLL_OPEN', payload: {} });
    }

    let sum = 0;
    const settled = [];
    for (let i = 0; i < mergedItems.length; i++) {
      await new Promise(r => setTimeout(r, 300 + i * 200));
      playDing(i);
      const sz = getTopSize(allEstimates[mergedItems[i].id]);
      const pts = TSHIRT_POINTS[sz] || 0;
      sum += pts;
      settled.push({ ...mergedItems[i], size: sz, pts });
      setSettledItems([...settled]);
      setTotal(sum);
    }
  };

  return (
    <div className="ns-step ns-sum-reveal">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16, textAlign: 'center', lineHeight: 2 }}>
        DUKKEN ÅBNER SIG
      </div>

      {!opened ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div className={`ns-doll-wrapper ${!opened ? 'ns-doll-clickable' : ''}`} onClick={handleOpen}>
            <MatryoshkaDoll itemName={item?.title} size={1.5} topRef={topRef} bottomRef={bottomRef} opening={opened} />
          </div>
          <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)' }} className="ns-pulse">
            CLICK TO OPEN
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
            <MatryoshkaDoll size={0.7} opening={true} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 560 }}>
            {settledItems.map((si, i) => (
              <div key={si.id} className="ns-settled-item" style={{ animationDelay: `${i * 0.15}s` }}>
                <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text)' }}>{si.title}</span>
                <span className="ns-estimate-badge">{si.size} · {si.pts}p</span>
              </div>
            ))}
          </div>

          {settledItems.length >= mergedItems.length && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--gold)' }}>{total}p TOTAL</div>
              <button className="ns-btn ns-btn-primary" onClick={() => onDone(total)}>
                VIEW GAP ANALYSIS →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
