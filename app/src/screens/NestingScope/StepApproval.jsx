import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PF, VT, TSHIRT_POINTS } from './nsHelpers.js';

export default function StepApproval({ sessionId, user, item, mergedItems, allEstimates, isGM, onDone }) {
  const [included, setIncluded] = useState(() => {
    const m = {};
    mergedItems.forEach(i => { m[i.id] = true; });
    return m;
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const getTopSize = (estimates) => {
    if (!estimates) return null;
    const counts = {};
    Object.values(estimates.votes || {}).forEach(sz => { counts[sz] = (counts[sz] || 0) + 1; });
    return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, [null, 0])[0];
  };

  const createChildItems = async () => {
    setLoading(true);
    const toCreate = mergedItems.filter(m => included[m.id]).map(m => {
      const sz = getTopSize(allEstimates[m.id]);
      return { id: m.id, title: m.title, tshirt_size: sz, estimate: TSHIRT_POINTS[sz] || 0 };
    });
    const { error } = await supabase.functions.invoke('finalize-nesting', { body: { session_id: sessionId, parent_item_id: item.id, items: toCreate } });
    if (!error) {
      await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'APPROVAL_DONE', payload: {} });
      setDone(true);
      onDone();
    }
    setLoading(false);
  };

  if (!isGM) {
    return (
      <div className="ns-step" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)' }} className="ns-pulse">
          Waiting for GM approval...
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="ns-step ns-celebration">
        <div style={{ fontSize: 64 }} className="ns-bounce">🎉</div>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)', marginTop: 16 }}>CHILD ITEMS CREATED!</div>
      </div>
    );
  }

  return (
    <div className="ns-step ns-approval">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16 }}>GM APPROVAL</div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
        Select items to create in PM
      </div>

      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mergedItems.map(m => {
          const sz = getTopSize(allEstimates[m.id]);
          return (
            <label key={m.id} className="ns-approval-row">
              <input type="checkbox" checked={!!included[m.id]} onChange={e => setIncluded(prev => ({ ...prev, [m.id]: e.target.checked }))} />
              <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--text)', flex: 1 }}>{m.title}</span>
              <span className="ns-estimate-badge">{sz} · {TSHIRT_POINTS[sz] || 0}p</span>
            </label>
          );
        })}
      </div>

      <button className="ns-btn ns-btn-primary" onClick={createChildItems} disabled={loading} style={{ marginTop: 24 }}>
        {loading ? 'CREATING...' : 'CREATE CHILD ITEMS IN PM'}
      </button>
    </div>
  );
}
