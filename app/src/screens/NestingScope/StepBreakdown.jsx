import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PF, VT } from './nsHelpers.js';

export default function StepBreakdown({ sessionId, user, item, participants, onSubmit }) {
  const [inputs, setInputs] = useState(['']);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`ns-breakdown-count-${sessionId}`)
      .on('broadcast', { event: 'SUBMITTED' }, ({ payload }) => { setSubmittedCount(payload.count); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  const addInput = () => { if (inputs.length < 5) setInputs(prev => [...prev, '']); };
  const removeInput = (i) => setInputs(prev => prev.filter((_, idx) => idx !== i));
  const updateInput = (i, val) => setInputs(prev => prev.map((v, idx) => idx === i ? val : v));

  const handleSubmit = async () => {
    const titles = inputs.map(s => s.trim()).filter(Boolean);
    if (!titles.length) return;
    const rows = titles.map(title => ({ session_id: sessionId, item_id: item.id, author_id: user.id, title, description: '', status: 'pending' }));
    await supabase.from('scope_submissions').insert(rows);
    setSubmitted(true);
    onSubmit(titles.length);
    await supabase.channel(`ns-breakdown-count-${sessionId}`).send({ type: 'broadcast', event: 'SUBMITTED', payload: { count: submittedCount + 1, userId: user.id } });
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 30;

  return (
    <div className="ns-step ns-breakdown">
      <div style={{ fontFamily: PF, fontSize: 10, color: urgent ? 'var(--danger)' : 'var(--gold)', marginBottom: 16 }}>
        {mins}:{secs}
      </div>
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--text)', marginBottom: 8, textAlign: 'center', lineHeight: 1.8 }}>
        WHAT SUB-TASKS<br />HIDE INSIDE?
      </div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 20, textAlign: 'center' }}>
        "{item?.title}"
      </div>

      {!submitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 480 }}>
          {inputs.map((val, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="ns-input" placeholder={`Sub-task ${i + 1}`} value={val} onChange={e => updateInput(i, e.target.value)} maxLength={80} />
              {inputs.length > 1 && <button className="ns-btn-icon" onClick={() => removeInput(i)}>✕</button>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {inputs.length < 5 && <button className="ns-btn ns-btn-secondary" onClick={addInput}>+ ADD</button>}
            <button className="ns-btn ns-btn-primary" onClick={handleSubmit}>SUBMIT</button>
          </div>
        </div>
      ) : (
        <div className="ns-submitted-box">
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--jade)' }}>SUBMITTED {inputs.filter(Boolean).length} ITEMS</div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text3)', marginTop: 24 }}>
        {submittedCount} / {participants.length} submitted
      </div>
    </div>
  );
}
