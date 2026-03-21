import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import MatryoshkaDoll from './MatryoshkaDoll.jsx';
import { PF, VT } from './nsHelpers.js';

export default function StepGMMerge({ sessionId, item, isGM, onMergeDone }) {
  const [submissions, setSubmissions] = useState([]);
  const [states, setStates] = useState({});
  const [renames, setRenames] = useState({});

  useEffect(() => {
    supabase.from('scope_submissions').select('*').eq('session_id', sessionId).eq('item_id', item.id)
      .then(({ data }) => {
        if (data) {
          setSubmissions(data);
          const s = {};
          data.forEach(d => { s[d.id] = 'active'; });
          setStates(s);
        }
      });
  }, [sessionId, item?.id]);

  const toggleDuplicate = (id) => setStates(prev => ({ ...prev, [id]: prev[id] === 'duplicate' ? 'active' : 'duplicate' }));
  const deleteItem = (id) => setStates(prev => ({ ...prev, [id]: 'deleted' }));
  const rename = (id, val) => setRenames(prev => ({ ...prev, [id]: val }));

  const confirmMerge = async () => {
    const approved = submissions.filter(s => states[s.id] === 'active');
    const rejected = submissions.filter(s => states[s.id] !== 'active');
    for (const s of approved) await supabase.from('scope_submissions').update({ status: 'approved', title: renames[s.id] || s.title }).eq('id', s.id);
    for (const s of rejected) await supabase.from('scope_submissions').update({ status: 'rejected' }).eq('id', s.id);
    const finalItems = approved.map(s => ({ id: s.id, title: renames[s.id] || s.title }));
    await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'MERGE_DONE', payload: { items: finalItems } });
    onMergeDone(finalItems);
  };

  if (!isGM) {
    return (
      <div className="ns-step" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <MatryoshkaDoll size={1} />
        <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)', marginTop: 20 }} className="ns-pulse">
          GM IS MERGING SCOPE...
        </div>
      </div>
    );
  }

  return (
    <div className="ns-step ns-gm-merge">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16 }}>GM MERGE</div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
        Review &amp; clean up submissions
      </div>

      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {submissions.map(s => {
          const st = states[s.id];
          if (st === 'deleted') return null;
          return (
            <div key={s.id} className={`ns-merge-row ${st === 'duplicate' ? 'ns-merge-dup' : ''}`}>
              <input className="ns-input ns-input-sm" value={renames[s.id] !== undefined ? renames[s.id] : s.title} onChange={e => rename(s.id, e.target.value)} disabled={st === 'duplicate'} />
              <button className={`ns-btn-tag ${st === 'duplicate' ? 'active' : ''}`} onClick={() => toggleDuplicate(s.id)} title="Mark duplicate">DUP</button>
              <button className="ns-btn-icon ns-danger" onClick={() => deleteItem(s.id)}>✕</button>
            </div>
          );
        })}
      </div>

      <button className="ns-btn ns-btn-primary" onClick={confirmMerge} style={{ marginTop: 24 }}>
        CONFIRM MERGE
      </button>
    </div>
  );
}
