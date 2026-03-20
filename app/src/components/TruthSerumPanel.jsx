import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function TruthSerumPanel({ sessionId, sessionItemId, isGm, C, PF }) {
  const [active, setActive] = useState(false);
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResponses, setShowResponses] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    // Check if truth serum is active
    supabase.from('sessions')
      .select('truth_serum_active')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.truth_serum_active) {
          setActive(true);
          setTimeLeft(60);
        }
      });

    // Listen for truth serum activation
    const channel = supabase.channel(`truthserum-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        if (payload.new?.truth_serum_active && !payload.old?.truth_serum_active) {
          setActive(true);
          setTimeLeft(60);
          setSubmitted(false);
          setShowResponses(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Countdown timer
  useEffect(() => {
    if (!active || timeLeft <= 0) return;
    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — load responses for GM
          if (isGm) loadResponses();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearTimeout(timerRef.current);
  }, [active, timeLeft, isGm]);

  async function loadResponses() {
    const { data } = await supabase.from('truth_serum_responses')
      .select('id, response, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setResponses(data || []);
    setShowResponses(true);
  }

  async function activateTruthSerum() {
    await supabase.from('sessions').update({ truth_serum_active: true }).eq('id', sessionId);
    setActive(true);
    setTimeLeft(60);
  }

  async function submitResponse() {
    if (!response.trim() || submitted) return;
    await supabase.from('truth_serum_responses').insert({
      session_id: sessionId,
      session_item_id: sessionItemId || null,
      response: response.trim(),
    });
    setSubmitted(true);
    setResponse('');
  }

  // GM: Show activate button if not active
  if (isGm && !active) {
    return (
      <button
        onClick={activateTruthSerum}
        style={{
          fontFamily: PF, fontSize: '5px', padding: '5px 10px',
          background: `${C?.pur || '#a855f7'}22`,
          color: C?.pur || '#a855f7',
          border: `2px solid ${C?.pur || '#a855f7'}44`,
          cursor: 'pointer', marginTop: 6,
        }}
      >
        💉 AKTIVER TRUTH SERUM
      </button>
    );
  }

  if (!active) return null;

  return (
    <div style={{
      marginTop: 8, padding: '10px',
      background: `${C?.pur || '#a855f7'}11`,
      border: `2px solid ${C?.pur || '#a855f7'}44`,
    }}>
      <div style={{
        fontFamily: PF, fontSize: '6px',
        color: C?.pur || '#a855f7',
        textAlign: 'center', marginBottom: 6,
      }}>
        💉 TRUTH SERUM ACTIVE {timeLeft > 0 && `· ${timeLeft}s`}
      </div>

      {/* Participant view: submit anonymous response */}
      {!isGm && !submitted && timeLeft > 0 && (
        <div>
          <div style={{
            fontFamily: PF, fontSize: '5px', color: C?.dim || '#888',
            textAlign: 'center', marginBottom: 6,
          }}>
            Hvad er det vi ikke tør sige højt om den her opgave?
          </div>
          <textarea
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Skriv anonymt..."
            style={{
              width: '100%', minHeight: 40, fontFamily: PF, fontSize: '6px',
              background: C?.bg || '#0e1019', color: C?.txt || '#ddd',
              border: `2px solid ${C?.pur || '#a855f7'}33`, padding: 6,
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={submitResponse}
            disabled={!response.trim()}
            style={{
              fontFamily: PF, fontSize: '5px', padding: '4px 10px',
              background: C?.pur || '#a855f7', color: '#fff',
              border: 'none', cursor: response.trim() ? 'pointer' : 'default',
              marginTop: 4, opacity: response.trim() ? 1 : 0.4,
            }}
          >
            SEND ANONYMT
          </button>
        </div>
      )}

      {!isGm && submitted && (
        <div style={{
          fontFamily: PF, fontSize: '5px', color: C?.grn || '#22c55e',
          textAlign: 'center',
        }}>
          ✓ Svar sendt anonymt
        </div>
      )}

      {!isGm && timeLeft <= 0 && !submitted && (
        <div style={{
          fontFamily: PF, fontSize: '5px', color: C?.dim || '#888',
          textAlign: 'center',
        }}>
          Tid udløbet
        </div>
      )}

      {/* GM view: show collected responses */}
      {isGm && timeLeft <= 0 && showResponses && (
        <div>
          <div style={{
            fontFamily: PF, fontSize: '5px', color: C?.pur || '#a855f7',
            marginBottom: 4,
          }}>
            {responses.length} ANONYME SVAR:
          </div>
          {responses.map((r, i) => (
            <div key={r.id} style={{
              fontFamily: PF, fontSize: '6px', color: C?.txt || '#ddd',
              padding: '4px 6px', marginBottom: 2,
              background: `${C?.bgL || '#1a1c2e'}`,
              border: `1px solid ${C?.brd || '#333'}`,
              borderLeft: `3px solid ${C?.pur || '#a855f7'}`,
            }}>
              "{r.response}"
            </div>
          ))}
          {responses.length === 0 && (
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888' }}>
              Ingen svar modtaget
            </div>
          )}
        </div>
      )}

      {isGm && timeLeft > 0 && (
        <div style={{
          fontFamily: PF, fontSize: '5px', color: C?.dim || '#888',
          textAlign: 'center',
        }}>
          Svar indsamles... vises om {timeLeft}s
        </div>
      )}

      {isGm && timeLeft <= 0 && !showResponses && (
        <button
          onClick={loadResponses}
          style={{
            fontFamily: PF, fontSize: '5px', padding: '4px 10px',
            background: C?.pur || '#a855f7', color: '#fff',
            border: 'none', cursor: 'pointer',
          }}
        >
          VIS SVAR
        </button>
      )}
    </div>
  );
}
