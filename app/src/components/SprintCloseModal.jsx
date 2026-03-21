import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getMembership } from '../lib/api';
import { handleSoftError } from "../lib/errorHandler";

export default function SprintCloseModal({ sprintId, sprintName, onClose, onClosed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!sprintId) return;
    supabase.from('session_items')
      .select('id, title, estimated_hours, actual_hours, actual_hours_logged, item_status')
      .eq('sprint_id', sprintId)
      .order('item_order')
      .then(({ data }) => {
        setItems((data || []).map(item => ({
          ...item,
          actual: item.actual_hours_logged || item.actual_hours || '',
        })));
        setLoading(false);
      });
  }, [sprintId]);

  function updateActual(id, value) {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, actual: value } : item
    ));
  }

  async function handleClose() {
    setClosing(true);
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) throw new Error('No org');

      // Calculate accuracy per item
      const measured = [];
      let totalOver = 0, totalUnder = 0, overCount = 0, underCount = 0;

      for (const item of items) {
        const actual = parseFloat(item.actual);
        const estimated = parseFloat(item.estimated_hours);
        if (!actual || !estimated || actual <= 0 || estimated <= 0) continue;

        const accuracy = (Math.min(actual, estimated) / Math.max(actual, estimated)) * 100;
        const ratio = actual / estimated;

        // Update item in DB
        await supabase.from('session_items').update({
          actual_hours_logged: actual,
          estimate_accuracy: accuracy,
        }).eq('id', item.id);

        measured.push({ accuracy, ratio });

        if (ratio > 1) { totalUnder += (ratio - 1) * 100; underCount++; }
        if (ratio < 1) { totalOver += (1 - ratio) * 100; overCount++; }
      }

      const avgAccuracy = measured.length > 0
        ? measured.reduce((sum, m) => sum + m.accuracy, 0) / measured.length
        : 0;

      const avgOver = overCount > 0 ? totalOver / overCount : 0;
      const avgUnder = underCount > 0 ? totalUnder / underCount : 0;

      // Update sprint status
      await supabase.from('sprints').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      }).eq('id', sprintId);

      // Save team accuracy score
      await supabase.from('team_accuracy_scores').insert({
        organization_id: membership.organization_id,
        sprint_id: sprintId,
        accuracy_score: avgAccuracy,
        items_measured: measured.length,
        avg_overestimate: avgOver,
        avg_underestimate: avgUnder,
      });

      setResult({
        accuracy: avgAccuracy,
        measured: measured.length,
        total: items.length,
        avgOver,
        avgUnder,
      });

      // Trigger XP/badge award
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-xp-badges`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ event: 'sprint_close', sprint_id: sprintId }),
          }).catch(() => {});
        }
      } catch (e) { handleSoftError(e, "sprint-close-webhook"); }

      onClosed?.();
    } catch (err) {
      console.error('Sprint close error:', err);
    }
    setClosing(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'grid', placeItems: 'center',
    }}
      onClick={onClose}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24,
        minWidth: 400, maxWidth: 600, maxHeight: '80vh', overflow: 'auto',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Result Screen */}
        {result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Sprint Closed!</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 48, color: result.accuracy > 80 ? 'var(--jade)' : result.accuracy > 60 ? 'var(--warn)' : 'var(--danger)', marginBottom: 8 }}>
              {result.accuracy.toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
              Estimation Accuracy · {result.measured}/{result.total} items measured
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
              {result.avgOver > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  📈 Avg overestimat: {result.avgOver.toFixed(0)}%
                </div>
              )}
              {result.avgUnder > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  📉 Avg underestimat: {result.avgUnder.toFixed(0)}%
                </div>
              )}
            </div>
            <button onClick={onClose} style={{
              fontSize: 13, fontWeight: 600, padding: '8px 20px',
              borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'var(--jade)', color: '#fff', border: 'none',
            }}>
              Luk
            </button>
          </div>
        )}

        {/* Input Screen */}
        {!result && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Luk Sprint</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sprintName}</div>
              </div>
              <button onClick={onClose} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '4px 10px',
                cursor: 'pointer', fontSize: 11, color: 'var(--text2)',
              }}>
                ✕
              </button>
            </div>

            {loading ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                  Angiv faktisk forbrug (timer) per item:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {items.map(item => (
                    <div key={item.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 80px',
                      gap: 8, alignItems: 'center',
                      padding: '8px 10px', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
                        Est: {item.estimated_hours || '—'}
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        value={item.actual}
                        onChange={e => updateActual(item.id, e.target.value)}
                        placeholder="Faktisk"
                        style={{
                          fontSize: 12, padding: '4px 6px', textAlign: 'center',
                          background: 'var(--bg)', border: '1px solid var(--border2)',
                          borderRadius: 'var(--radius)', color: 'var(--text)',
                          width: '100%', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={onClose} style={{
                    fontSize: 12, padding: '6px 14px',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: 'var(--bg3)', color: 'var(--text2)',
                    border: '1px solid var(--border)',
                  }}>
                    Annuller
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={closing}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '6px 14px',
                      borderRadius: 'var(--radius)', cursor: closing ? 'default' : 'pointer',
                      background: closing ? 'var(--bg3)' : 'var(--jade)',
                      color: '#fff', border: 'none',
                    }}
                  >
                    {closing ? 'Lukker...' : '✓ Luk Sprint'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
