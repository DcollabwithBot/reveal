import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { playBuzz, playDing } from './nsAudio.js';
import { PF, VT, TSHIRT_SIZES, TSHIRT_POINTS } from './nsHelpers.js';

export default function StepQuickEstimate({ sessionId, user, item, mergedItems, participants, onAllDone }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [votes, setVotes] = useState({});
  const [timeLeft, setTimeLeft] = useState(15);
  const [revealed, setRevealed] = useState(false);
  const [allEstimates, setAllEstimates] = useState({});
  const timerRef = useRef(null);

  const currentItem = mergedItems[currentIdx];

  const resetTimer = () => { setTimeLeft(15); setMyVote(null); setVotes({}); setRevealed(false); };

  useEffect(() => { resetTimer(); }, [currentIdx]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setRevealed(true); if (t === 1) playBuzz(); return 0; }
        if (t === 5) playBuzz();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIdx]);

  useEffect(() => {
    const ch = supabase.channel(`ns-estimate-${sessionId}-${currentIdx}`)
      .on('broadcast', { event: 'VOTE' }, ({ payload }) => {
        setVotes(prev => {
          const next = { ...prev, [payload.userId]: payload.size };
          if (Object.keys(next).length >= participants.length) { clearInterval(timerRef.current); setRevealed(true); }
          return next;
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId, currentIdx, participants.length]);

  const vote = async (size) => {
    if (myVote) return;
    setMyVote(size);
    await supabase.from('scope_estimates').insert({ session_id: sessionId, item_id: currentItem.id, user_id: user.id, tshirt_size: size, round: 1 });
    await supabase.channel(`ns-estimate-${sessionId}-${currentIdx}`).send({ type: 'broadcast', event: 'VOTE', payload: { userId: user.id, size } });
  };

  const advance = () => {
    const newEstimates = { ...allEstimates, [currentItem.id]: { votes, item: currentItem } };
    setAllEstimates(newEstimates);
    if (currentIdx + 1 >= mergedItems.length) { onAllDone(newEstimates); }
    else { setCurrentIdx(i => i + 1); }
  };

  const urgent = timeLeft < 5;
  const voteCounts = TSHIRT_SIZES.map(sz => ({ size: sz, count: Object.values(votes).filter(v => v === sz).length }));
  const topSize = revealed && voteCounts.reduce((a, b) => b.count > a.count ? b : a, voteCounts[0]);

  return (
    <div className="ns-step ns-estimate">
      <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 8 }}>
        ITEM {currentIdx + 1} / {mergedItems.length}
      </div>
      <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)', marginBottom: 4, textAlign: 'center' }}>
        {currentItem?.title}
      </div>

      <div style={{ fontFamily: PF, fontSize: 28, color: urgent ? 'var(--danger)' : 'var(--gold)', marginBottom: 20, animation: urgent ? 'ns-pulse 0.5s infinite' : 'none' }}>
        {timeLeft}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
        {TSHIRT_SIZES.map(sz => (
          <button key={sz} className={`ns-vote-card ${myVote === sz ? 'ns-vote-selected' : ''} ${revealed && topSize?.size === sz ? 'ns-vote-winner' : ''}`} onClick={() => vote(sz)} disabled={!!myVote || revealed}>
            <span style={{ fontFamily: PF, fontSize: 10 }}>{sz}</span>
            <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{TSHIRT_POINTS[sz]}p</span>
            {revealed && <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--gold)' }}>{voteCounts.find(v => v.size === sz)?.count || 0}</span>}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text3)' }}>
        {Object.keys(votes).length} / {participants.length} voted
      </div>

      {revealed && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {topSize && <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)' }}>→ {topSize.size} ({TSHIRT_POINTS[topSize.size]}p)</div>}
          <button className="ns-btn ns-btn-primary" onClick={advance}>
            {currentIdx + 1 >= mergedItems.length ? 'OPEN THE DOLL →' : 'NEXT ITEM →'}
          </button>
        </div>
      )}
    </div>
  );
}
