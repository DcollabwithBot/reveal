import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from './Toast';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export default function EstimationPanel({ item }) {
  const [open, setOpen] = useState(false);
  const [sessionName, setSessionName] = useState(item.title || '');
  const [votingMode, setVotingMode] = useState('fibonacci');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState({});

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${item.id}/estimation-sessions`, { headers });
      if (r.ok) setHistory(await r.json());
    } catch { /* ignorér */ }
    setHistoryLoading(false);
  }, [item.id]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  async function handleCreate() {
    setCreating(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${item.id}/estimation-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_name: sessionName, voting_mode: votingMode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fejl');
      setToast(`Session oprettet — join kode: ${data.join_code}`);
      setOpen(false);
      loadHistory();
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setCreating(false);
  }

  async function handleApply(sessionItemId) {
    setApplyingId(sessionItemId);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/estimation-results/${sessionItemId}/apply`, { method: 'POST', headers });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fejl');
      setPendingApprovals(prev => ({ ...prev, [sessionItemId]: true }));
      setToast('Estimat sendt til PM-godkendelse');
      loadHistory();
    } catch (e) {
      setToast(`Fejl: ${e.message}`);
    }
    setApplyingId(null);
  }

  return (
    <div style={{ marginTop: 8 }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* "Send til estimering" knap */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius)',
          background: open ? 'var(--epic-dim)' : 'transparent',
          border: '1px solid var(--epic-border)',
          color: 'var(--epic)', cursor: 'pointer', fontWeight: 600,
        }}
      >
        ⚔ {open ? 'Luk' : 'Send til estimering'}
      </button>

      {/* Inline opret-form */}
      {open && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Ny estimation-session</div>
          <input
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Session navn"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 11, padding: '5px 8px' }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {['fibonacci', 't-shirt'].map(m => (
              <button
                key={m}
                onClick={() => setVotingMode(m)}
                style={{
                  fontSize: 10, padding: '3px 9px', borderRadius: 'var(--radius)', cursor: 'pointer', border: 'none',
                  background: votingMode === m ? 'var(--jade-dim)' : 'var(--bg3)',
                  color: votingMode === m ? 'var(--jade)' : 'var(--text2)',
                  outline: votingMode === m ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
                }}
              >
                {m === 'fibonacci' ? 'Fibonacci' : 'T-shirt'}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !sessionName.trim()}
            style={{
              fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)', cursor: creating ? 'wait' : 'pointer',
              background: 'var(--jade)', color: '#0c0c0f', border: 'none', fontWeight: 600, opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Opretter...' : 'Opret session →'}
          </button>
        </div>
      )}

      {/* Estimation history */}
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Tidligere estimater {historyLoading ? '…' : ''}
          </div>
          {history?.length === 0 && !historyLoading && (
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Ingen estimation-sessions endnu.</div>
          )}
          {history?.map(h => (
            <div key={h.session_item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{h.session_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {new Date(h.created_at).toLocaleDateString('da-DK')} · {h.session_status}
                  {h.final_estimate ? ` · ${h.final_estimate}h` : ' · ikke estimeret'}
                </div>
              </div>
              {h.final_estimate && !pendingApprovals[h.session_item_id] && (
                <button
                  onClick={() => handleApply(h.session_item_id)}
                  disabled={applyingId === h.session_item_id}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: 'var(--gold-dim)', border: '1px solid rgba(200,168,75,0.3)', color: 'var(--gold)', fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {applyingId === h.session_item_id ? '...' : 'Anvend estimat'}
                </button>
              )}
              {(pendingApprovals[h.session_item_id]) && (
                <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>Afventer PM-godkendelse</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
