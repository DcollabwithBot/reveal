import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from "../lib/errorHandler";

const LIFELINES = [
  { type: 'call_expert', icon: '📞', label: 'Call Expert', desc: 'Ring til en ekspert', gmOnly: true },
  { type: 'scope_reduction', icon: '✂️', label: 'Scope Cut', desc: 'Fjern scope-antagelser', gmOnly: true },
  { type: 'audience_vote', icon: '🗳️', label: 'Audience', desc: 'Anonym afstemning', gmOnly: false },
  { type: 'facilitator_insight', icon: '💡', label: 'Hint', desc: 'Facilitator blind spot', gmOnly: true },
];

export default function LifelinesPanel({ sessionId, userId, isGm, C, PF }) {
  const [usedLifelines, setUsedLifelines] = useState({}); // { type: resultData }
  const [activeLifeline, setActiveLifeline] = useState(null); // currently showing modal
  const [inputText, setInputText] = useState('');
  const [assumptions, setAssumptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [audienceVotes, setAudienceVotes] = useState([]); // for audience vote
  const [myAudienceVote, setMyAudienceVote] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    // Load existing lifelines
    supabase.from('session_lifelines')
      .select('id, lifeline_type, used_by, result_data, used_at')
      .eq('session_id', sessionId)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(l => { map[l.lifeline_type] = l; });
        setUsedLifelines(map);
      });

    // Subscribe to new lifelines
    const channel = supabase.channel(`lifelines-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_lifelines',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const l = payload.new;
        setUsedLifelines(prev => ({ ...prev, [l.lifeline_type]: l }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  async function useLifeline(type, resultData = {}) {
    if (usedLifelines[type]) return;
    setBusy(true);
    try {
      await supabase.from('session_lifelines').insert({
        session_id: sessionId,
        lifeline_type: type,
        used_by: userId,
        result_data: resultData,
      });
      setActiveLifeline(null);
      setInputText('');
      setAssumptions(['', '']);
    } catch (e) { handleError(e, "mark-lifeline-used"); }
    setBusy(false);
  }

  async function submitAudienceVote(value) {
    setMyAudienceVote(value);
    // Store as part of the lifeline result data (append to existing)
    const existing = usedLifelines['audience_vote']?.result_data?.votes || [];
    const updated = [...existing, { value, timestamp: new Date().toISOString() }];
    await supabase.from('session_lifelines')
      .update({ result_data: { votes: updated } })
      .eq('session_id', sessionId)
      .eq('lifeline_type', 'audience_vote');
    setAudienceVotes(updated);
  }

  function openLifeline(lifeline) {
    if (usedLifelines[lifeline.type]) return;
    if (lifeline.gmOnly && !isGm) return;
    setActiveLifeline(lifeline);
    setInputText('');
    setAssumptions(['', '']);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', letterSpacing: '2px', marginBottom: '4px', textAlign: 'center' }}>
        ◈ LIFELINES ◈
      </div>

      {/* Lifeline Icons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '6px' }}>
        {LIFELINES.map(l => {
          const used = !!usedLifelines[l.type];
          const canUse = !used && (isGm || !l.gmOnly);
          return (
            <div
              key={l.type}
              onClick={() => canUse && openLifeline(l)}
              title={used ? `${l.label} — Used` : l.desc}
              style={{
                textAlign: 'center',
                cursor: canUse ? 'pointer' : 'default',
                opacity: used ? 0.3 : (canUse ? 1 : 0.5),
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 36, height: 36, margin: '0 auto', borderRadius: '50%',
                background: used ? (C?.bgL || '#1a1c2e') : `${C?.pur || '#a855f7'}22`,
                border: `2px solid ${used ? (C?.brd || '#333') : (C?.pur || '#a855f7')}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
                animation: canUse && !used ? 'float 2s ease-in-out infinite' : 'none',
              }}>
                {l.icon}
              </div>
              <div style={{ fontFamily: PF, fontSize: '4px', color: used ? (C?.dim || '#666') : (C?.txt || '#ddd'), marginTop: 2 }}>
                {used ? 'USED' : l.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active result display */}
      {usedLifelines['call_expert']?.result_data?.expert_input && (
        <ResultBox C={C} PF={PF} icon="📞" label="Expert Input">
          {usedLifelines['call_expert'].result_data.expert_input}
        </ResultBox>
      )}
      {usedLifelines['scope_reduction']?.result_data?.removed_assumptions?.length > 0 && (
        <ResultBox C={C} PF={PF} icon="✂️" label="Removed Assumptions">
          {usedLifelines['scope_reduction'].result_data.removed_assumptions.map((a, i) => (
            <div key={i} style={{ textDecoration: 'line-through', color: C?.dim || '#888' }}>— {a}</div>
          ))}
        </ResultBox>
      )}
      {usedLifelines['facilitator_insight']?.result_data?.hint && (
        <ResultBox C={C} PF={PF} icon="💡" label="Facilitator Hint">
          {usedLifelines['facilitator_insight'].result_data.hint}
        </ResultBox>
      )}
      {usedLifelines['audience_vote'] && (
        <AudienceVoteDisplay
          C={C} PF={PF}
          votes={usedLifelines['audience_vote']?.result_data?.votes || audienceVotes}
          myVote={myAudienceVote}
          onVote={!myAudienceVote ? submitAudienceVote : null}
        />
      )}

      {/* Modal */}
      {activeLifeline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300,
        }}
          onClick={() => setActiveLifeline(null)}
        >
          <div style={{
            background: C?.bgC || '#14162a', border: `3px solid ${C?.pur || '#a855f7'}`,
            padding: 16, maxWidth: 340, width: '90%',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: PF, fontSize: '8px', color: C?.pur || '#a855f7', textAlign: 'center', marginBottom: 8 }}>
              {activeLifeline.icon} {activeLifeline.label}
            </div>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', textAlign: 'center', marginBottom: 10 }}>
              {activeLifeline.desc}
            </div>

            {/* Call Expert */}
            {activeLifeline.type === 'call_expert' && (
              <>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Ekspert input / noter..."
                  style={modalInput(C, PF)}
                />
                <button
                  onClick={() => useLifeline('call_expert', { expert_input: inputText })}
                  disabled={busy}
                  style={modalBtn(C, PF, busy)}
                >
                  📞 LOG EXPERT INPUT
                </button>
              </>
            )}

            {/* Scope Reduction */}
            {activeLifeline.type === 'scope_reduction' && (
              <>
                <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', marginBottom: 6 }}>
                  Fjern 2 scope-antagelser:
                </div>
                {assumptions.map((a, i) => (
                  <input
                    key={i}
                    value={a}
                    onChange={e => {
                      const next = [...assumptions];
                      next[i] = e.target.value;
                      setAssumptions(next);
                    }}
                    placeholder={`Antagelse ${i + 1}...`}
                    style={{ ...modalInput(C, PF), marginBottom: 4 }}
                  />
                ))}
                <button
                  onClick={() => useLifeline('scope_reduction', { removed_assumptions: assumptions.filter(a => a.trim()) })}
                  disabled={busy || !assumptions.some(a => a.trim())}
                  style={modalBtn(C, PF, busy)}
                >
                  ✂️ CUT SCOPE
                </button>
              </>
            )}

            {/* Audience Vote */}
            {activeLifeline.type === 'audience_vote' && (
              <button
                onClick={() => useLifeline('audience_vote', { votes: [] })}
                disabled={busy}
                style={modalBtn(C, PF, busy)}
              >
                🗳️ START AUDIENCE VOTE
              </button>
            )}

            {/* Facilitator Insight */}
            {activeLifeline.type === 'facilitator_insight' && (
              <>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Hint: Overvej..."
                  style={modalInput(C, PF)}
                />
                <button
                  onClick={() => useLifeline('facilitator_insight', { hint: inputText })}
                  disabled={busy || !inputText.trim()}
                  style={modalBtn(C, PF, busy)}
                >
                  💡 SEND HINT
                </button>
              </>
            )}

            <button
              onClick={() => setActiveLifeline(null)}
              style={{
                fontFamily: PF, fontSize: '5px', padding: '4px 10px',
                background: 'transparent', color: C?.dim || '#888',
                border: `1px solid ${C?.brd || '#333'}`, cursor: 'pointer',
                marginTop: 6, width: '100%',
              }}
            >
              ANNULLER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBox({ C, PF, icon, label, children }) {
  return (
    <div style={{
      fontFamily: PF, fontSize: '5px',
      padding: '4px 8px', marginBottom: 4,
      background: `${C?.pur || '#a855f7'}11`,
      border: `1px solid ${C?.pur || '#a855f7'}33`,
      borderLeft: `3px solid ${C?.pur || '#a855f7'}`,
    }}>
      <div style={{ color: C?.pur || '#a855f7', marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ color: C?.txt || '#ddd', fontSize: '6px' }}>{children}</div>
    </div>
  );
}

function AudienceVoteDisplay({ C, PF, votes, myVote, onVote }) {
  const values = [1, 2, 3, 5, 8, 13, 21];
  const distribution = {};
  (votes || []).forEach(v => {
    distribution[v.value] = (distribution[v.value] || 0) + 1;
  });
  const maxCount = Math.max(1, ...Object.values(distribution));

  return (
    <div style={{
      padding: '6px 8px', marginBottom: 4,
      background: `${C?.pur || '#a855f7'}11`,
      border: `1px solid ${C?.pur || '#a855f7'}33`,
    }}>
      <div style={{ fontFamily: PF, fontSize: '5px', color: C?.pur || '#a855f7', marginBottom: 4 }}>
        🗳️ AUDIENCE VOTE · {votes?.length || 0} stemmer
      </div>
      {onVote && !myVote && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 4 }}>
          {values.map(v => (
            <div
              key={v}
              onClick={() => onVote(v)}
              style={{
                fontFamily: PF, fontSize: '6px', color: C?.txt || '#ddd',
                padding: '3px 6px', cursor: 'pointer',
                background: C?.bgL || '#1a1c2e',
                border: `1px solid ${C?.brd || '#333'}`,
              }}
            >
              {v}
            </div>
          ))}
        </div>
      )}
      {/* Heatmap */}
      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 30 }}>
        {values.map(v => {
          const count = distribution[v] || 0;
          const height = count > 0 ? Math.max(4, (count / maxCount) * 28) : 2;
          return (
            <div key={v} style={{ textAlign: 'center' }}>
              <div style={{
                width: 16, height,
                background: count > 0 ? (C?.pur || '#a855f7') : `${C?.brd || '#333'}44`,
                borderRadius: 1,
                transition: 'height 0.3s',
              }} />
              <div style={{ fontFamily: PF, fontSize: '4px', color: C?.dim || '#888', marginTop: 1 }}>{v}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function modalInput(C, PF) {
  return {
    width: '100%', fontFamily: PF, fontSize: '6px',
    background: C?.bg || '#0e1019', color: C?.txt || '#ddd',
    border: `2px solid ${C?.brd || '#333'}`, padding: 6,
    boxSizing: 'border-box', marginBottom: 6,
  };
}

function modalBtn(C, PF, busy) {
  return {
    fontFamily: PF, fontSize: '6px', padding: '6px 14px',
    background: C?.pur || '#a855f7', color: '#fff',
    border: 'none', cursor: busy ? 'default' : 'pointer',
    width: '100%', opacity: busy ? 0.5 : 1,
  };
}

export { LIFELINES };
