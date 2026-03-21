/**
 * LifelinesPanel — v3.1 complete implementation
 * 5 lifelines as strategic session resources.
 * Stored in sessions.metadata.lifelines_used JSONB.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const LIFELINES = [
  {
    type: 'call_expert',
    icon: '📞',
    label: 'Call Expert',
    desc: 'GM inviterer en ekstern ekspert midlertidigt',
    gmOnly: true,
  },
  {
    type: 'fifty_fifty',
    icon: '⚡',
    label: '50/50',
    desc: 'Fjerner halvdelen af stemmemulighederne (random)',
    gmOnly: true,
  },
  {
    type: 'audience_vote',
    icon: '👥',
    label: 'Audience',
    desc: 'Alle observers får stemmeret i 60 sek',
    gmOnly: false,
  },
  {
    type: 'facilitator_insight',
    icon: '💡',
    label: 'Insight',
    desc: 'GM-only: vis outlier inden reveal',
    gmOnly: true,
  },
  {
    type: 'ai_lifeline',
    icon: '🤖',
    label: 'AI Lifeline',
    desc: 'AI-estimat baseret på historiske items · kun 1x',
    gmOnly: false,
    oneTime: true,
  },
];

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export default function LifelinesPanel({ sessionId, userId, isGm, currentItemTitle, C, PF }) {
  const [usedLifelines, setUsedLifelines] = useState({}); // { type: resultData }
  const [activeLifeline, setActiveLifeline] = useState(null);
  const [inputText, setInputText] = useState('');
  const [assumptions, setAssumptions] = useState(['', '']);
  const [audienceVotes, setAudienceVotes] = useState([]);
  const [myAudienceVote, setMyAudienceVote] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removedOptions, setRemovedOptions] = useState(null); // 50/50 result
  const [outlier, setOutlier] = useState(null); // facilitator insight

  useEffect(() => {
    if (!sessionId) return;
    loadLifelineState();

    // Subscribe to realtime session metadata changes
    const channel = supabase.channel(`lifelines-session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const used = payload.new?.metadata?.lifelines_used || {};
        setUsedLifelines(used);
        // Sync audience votes from metadata
        if (used.audience_vote?.votes) setAudienceVotes(used.audience_vote.votes);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLifelineState() {
    const { data } = await supabase
      .from('sessions')
      .select('metadata')
      .eq('id', sessionId)
      .maybeSingle();
    const used = data?.metadata?.lifelines_used || {};
    setUsedLifelines(used);
    if (used.audience_vote?.votes) setAudienceVotes(used.audience_vote.votes);
    if (used.fifty_fifty?.removed) setRemovedOptions(used.fifty_fifty.removed);
    if (used.facilitator_insight?.outlier_estimate) setOutlier(used.facilitator_insight);
  }

  async function markLifelineUsed(type, resultData = {}) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    const existing = sess?.metadata || {};
    const usedMap = existing.lifelines_used || {};
    usedMap[type] = {
      used_at: new Date().toISOString(),
      used_by: userId,
      ...resultData,
    };
    await supabase.from('sessions').update({
      metadata: { ...existing, lifelines_used: usedMap },
    }).eq('id', sessionId);

    setUsedLifelines(prev => ({ ...prev, [type]: usedMap[type] }));
  }

  async function useCallExpert() {
    if (!inputText.trim()) return;
    setBusy(true);
    await markLifelineUsed('call_expert', { expert_input: inputText });
    setActiveLifeline(null);
    setInputText('');
    setBusy(false);
  }

  async function useFiftyFifty() {
    setBusy(true);
    const allOptions = [1, 2, 3, 5, 8, 13, 21];
    const toRemove = [...allOptions].sort(() => Math.random() - 0.5).slice(0, 3);
    const remaining = allOptions.filter(o => !toRemove.includes(o));
    setRemovedOptions(toRemove);
    await markLifelineUsed('fifty_fifty', { removed: toRemove, remaining });
    setActiveLifeline(null);
    setBusy(false);
  }

  async function useAudienceVote() {
    setBusy(true);
    await markLifelineUsed('audience_vote', { votes: [], started_at: new Date().toISOString() });
    setActiveLifeline(null);
    setBusy(false);
  }

  async function submitAudienceVote(value) {
    setMyAudienceVote(value);
    const updated = [...audienceVotes, { value, user_id: userId, ts: Date.now() }];
    setAudienceVotes(updated);
    const { data: sess } = await supabase.from('sessions').select('metadata').eq('id', sessionId).single();
    const existing = sess?.metadata || {};
    const usedMap = existing.lifelines_used || {};
    if (usedMap.audience_vote) usedMap.audience_vote.votes = updated;
    await supabase.from('sessions').update({ metadata: { ...existing, lifelines_used: usedMap } }).eq('id', sessionId);
  }

  async function useFacilitatorInsight() {
    // Show who the outlier is — requires knowing current votes
    // We estimate by looking at recent votes for current session
    setBusy(true);
    const { data: votes } = await supabase
      .from('votes')
      .select('user_id, value')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    let insightData = { hint: 'Ikke nok stemmer til at beregne outlier.' };
    if (votes?.length >= 3) {
      const vals = votes.map(v => Number(v.value)).filter(Boolean);
      const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];
      const outlierVote = votes.reduce((max, v) =>
        Math.abs(Number(v.value) - median) > Math.abs(Number(max.value) - median) ? v : max, votes[0]);
      insightData = {
        hint: `Outlier estimat: ${outlierVote.value} (median: ${median})`,
        outlier_estimate: outlierVote.value,
        median,
      };
      setOutlier(insightData);
    }
    await markLifelineUsed('facilitator_insight', insightData);
    setActiveLifeline(null);
    setInputText('');
    setBusy(false);
  }

  async function useAiLifeline() {
    if (!currentItemTitle) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      const resp = await fetch('/functions/v1/ai-lifeline', {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_id: sessionId, item_title: currentItemTitle }),
      });
      if (!resp.ok) throw new Error('AI lifeline failed');
      const result = await resp.json();
      setAiResult(result);
      await markLifelineUsed('ai_lifeline', result);
    } catch {
      // Fallback: show that AI lifeline was used but result unavailable
      const fallback = { avg_estimate: null, error: 'Ingen historiske data fundet for dette item' };
      setAiResult(fallback);
      await markLifelineUsed('ai_lifeline', fallback);
    }
    setActiveLifeline(null);
    setBusy(false);
  }

  function openLifeline(lifeline) {
    const used = !!usedLifelines[lifeline.type];
    if (used) return;
    if (lifeline.gmOnly && !isGm) return;
    setActiveLifeline(lifeline);
    setInputText('');
    setAssumptions(['', '']);
  }

  const FIB = [1, 2, 3, 5, 8, 13, 21];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontFamily: PF, fontSize: '5px', color: C?.dim || '#888',
        letterSpacing: '2px', marginBottom: '4px', textAlign: 'center',
      }}>
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
              title={used ? `${l.label} — Brugt` : `${l.label}: ${l.desc}`}
              style={{
                textAlign: 'center', cursor: canUse ? 'pointer' : 'default',
                opacity: used ? 0.3 : canUse ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 36, height: 36, margin: '0 auto', borderRadius: '50%',
                background: used ? (C?.bgL || '#1a1c2e') : `${C?.pur || '#a855f7'}22`,
                border: `2px solid ${used ? (C?.brd || '#333') : l.type === 'ai_lifeline' ? (C?.grn || '#00c896') : (C?.pur || '#a855f7')}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
                animation: canUse && !used ? 'float 2s ease-in-out infinite' : 'none',
              }}>
                {l.icon}
              </div>
              <div style={{ fontFamily: PF, fontSize: '4px', color: used ? (C?.dim || '#666') : (C?.txt || '#ddd'), marginTop: 2 }}>
                {used ? 'USED' : l.label.toUpperCase().slice(0, 6)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active result display */}
      {usedLifelines['call_expert']?.expert_input && (
        <ResultBox C={C} PF={PF} icon="📞" label="Expert Input">
          {usedLifelines['call_expert'].expert_input}
        </ResultBox>
      )}
      {removedOptions && (
        <ResultBox C={C} PF={PF} icon="⚡" label="50/50 — Fjernede muligheder">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FIB.map(v => (
              <span key={v} style={{
                fontFamily: PF, fontSize: '7px',
                color: removedOptions.includes(v) ? C?.dim || '#555' : C?.pur || '#a855f7',
                textDecoration: removedOptions.includes(v) ? 'line-through' : 'none',
                padding: '2px 6px',
                background: removedOptions.includes(v) ? 'transparent' : `${C?.pur || '#a855f7'}22`,
              }}>{v}</span>
            ))}
          </div>
        </ResultBox>
      )}
      {outlier && (
        <ResultBox C={C} PF={PF} icon="💡" label="Facilitator Insight">
          {outlier.hint}
        </ResultBox>
      )}
      {aiResult && (
        <ResultBox C={C} PF={PF} icon="🤖" label="AI Lifeline">
          {aiResult.error
            ? aiResult.error
            : `Historisk snit: ${aiResult.avg_estimate}p · min ${aiResult.min_estimate} · max ${aiResult.max_estimate} · ${aiResult.similar_items_count} lignende items`
          }
        </ResultBox>
      )}
      {usedLifelines['audience_vote'] && (
        <AudienceVoteDisplay
          C={C} PF={PF}
          votes={audienceVotes}
          myVote={myAudienceVote}
          onVote={!myAudienceVote ? submitAudienceVote : null}
        />
      )}

      {/* Modal */}
      {activeLifeline && (
        <LifelineModal
          lifeline={activeLifeline}
          inputText={inputText}
          setInputText={setInputText}
          assumptions={assumptions}
          setAssumptions={setAssumptions}
          busy={busy}
          onClose={() => setActiveLifeline(null)}
          onCallExpert={useCallExpert}
          onFiftyFifty={useFiftyFifty}
          onAudienceVote={useAudienceVote}
          onFacilitatorInsight={useFacilitatorInsight}
          onAiLifeline={useAiLifeline}
          currentItemTitle={currentItemTitle}
          C={C}
          PF={PF}
        />
      )}
    </div>
  );
}

function LifelineModal({
  lifeline, inputText, setInputText, assumptions, setAssumptions,
  busy, onClose, onCallExpert, onFiftyFifty, onAudienceVote,
  onFacilitatorInsight, onAiLifeline, currentItemTitle, C, PF,
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        background: C?.bgC || '#14162a',
        border: `3px solid ${lifeline.type === 'ai_lifeline' ? (C?.grn || '#00c896') : (C?.pur || '#a855f7')}`,
        padding: 16, maxWidth: 340, width: '90%', borderRadius: 0,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: PF, fontSize: '8px', color: lifeline.type === 'ai_lifeline' ? (C?.grn || '#00c896') : (C?.pur || '#a855f7'), textAlign: 'center', marginBottom: 8 }}>
          {lifeline.icon} {lifeline.label.toUpperCase()}
        </div>
        <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', textAlign: 'center', marginBottom: 12, lineHeight: 2 }}>
          {lifeline.desc}
        </div>

        {lifeline.type === 'call_expert' && (
          <>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Ekspert input / noter fra samtalen..."
              rows={3}
              style={{ ...modalInput(C, PF), resize: 'vertical' }}
            />
            <button onClick={onCallExpert} disabled={busy || !inputText.trim()} style={modalBtn(C, PF, busy)}>
              📞 LOG EXPERT INPUT
            </button>
          </>
        )}

        {lifeline.type === 'fifty_fifty' && (
          <>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', marginBottom: 10, lineHeight: 2, textAlign: 'center' }}>
              ⚡ FJERNER 3 TILFÆLDIGE STEMME-MULIGHEDER<br />
              Tilbageværende: ~4 muligheder
            </div>
            <button onClick={onFiftyFifty} disabled={busy} style={modalBtn(C, PF, busy)}>
              ⚡ AKTIVER 50/50
            </button>
          </>
        )}

        {lifeline.type === 'audience_vote' && (
          <>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', marginBottom: 10, lineHeight: 2, textAlign: 'center' }}>
              👥 ALLE OBSERVERS FÅR STEMMERET I 60 SEK
            </div>
            <button onClick={onAudienceVote} disabled={busy} style={modalBtn(C, PF, busy)}>
              👥 START AUDIENCE VOTE
            </button>
          </>
        )}

        {lifeline.type === 'facilitator_insight' && (
          <>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', marginBottom: 10, lineHeight: 2, textAlign: 'center' }}>
              💡 VIS HVEM DER ER OUTLIER INDEN REVEAL<br />
              (Baseret på aktuelle stemmer)
            </div>
            <button onClick={onFacilitatorInsight} disabled={busy} style={modalBtn(C, PF, busy)}>
              💡 REVEAL OUTLIER
            </button>
          </>
        )}

        {lifeline.type === 'ai_lifeline' && (
          <>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', marginBottom: 10, lineHeight: 2, textAlign: 'center' }}>
              🤖 AI ESTIMAT BASERET PÅ HISTORISKE ITEMS<br />
              {currentItemTitle
                ? `→ "${currentItemTitle.slice(0, 40)}${currentItemTitle.length > 40 ? '...' : ''}"`
                : '(Intet item valgt)'
              }
            </div>
            <button
              onClick={onAiLifeline}
              disabled={busy || !currentItemTitle}
              style={{ ...modalBtn(C, PF, busy || !currentItemTitle), background: C?.grn || '#00c896' }}
            >
              🤖 AKTIVÉR AI LIFELINE
            </button>
          </>
        )}

        <button
          onClick={onClose}
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
  );
}

function ResultBox({ C, PF, icon, label, children }) {
  return (
    <div style={{
      fontFamily: PF, fontSize: '5px', padding: '4px 8px', marginBottom: 4,
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
  (votes || []).forEach(v => { distribution[v.value] = (distribution[v.value] || 0) + 1; });
  const maxCount = Math.max(1, ...Object.values(distribution));

  return (
    <div style={{
      padding: '6px 8px', marginBottom: 4,
      background: `${C?.pur || '#a855f7'}11`,
      border: `1px solid ${C?.pur || '#a855f7'}33`,
    }}>
      <div style={{ fontFamily: PF, fontSize: '5px', color: C?.pur || '#a855f7', marginBottom: 4 }}>
        👥 AUDIENCE VOTE · {votes?.length || 0} stemmer
      </div>
      {onVote && !myVote && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 4 }}>
          {values.map(v => (
            <div key={v} onClick={() => onVote(v)} style={{
              fontFamily: PF, fontSize: '6px', color: C?.txt || '#ddd',
              padding: '3px 6px', cursor: 'pointer',
              background: C?.bgL || '#1a1c2e', border: `1px solid ${C?.brd || '#333'}`,
            }}>{v}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 30 }}>
        {values.map(v => {
          const count = distribution[v] || 0;
          const height = count > 0 ? Math.max(4, (count / maxCount) * 28) : 2;
          return (
            <div key={v} style={{ textAlign: 'center' }}>
              <div style={{ width: 16, height, background: count > 0 ? (C?.pur || '#a855f7') : `${C?.brd || '#333'}44`, borderRadius: 1, transition: 'height 0.3s' }} />
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
