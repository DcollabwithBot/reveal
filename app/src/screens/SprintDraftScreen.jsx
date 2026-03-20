import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getDraftState, submitDraftPicks, submitPriorityVotes, finalizeDraft } from '../lib/api';

const STEPS = ['lobby', 'priority', 'draft', 'summary'];
const PRIORITY_TOKENS = 5;
const VOTE_TIMER_SECONDS = 60;

// ── Capacity Gauge ────────────────────────────────────────────────────────────
function CapacityGauge({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 105) : 0;
  const color = pct > 95 ? 'var(--danger)' : pct > 80 ? 'var(--gold)' : 'var(--jade)';
  const pulse = pct > 90;

  return (
    <div style={gaugeStyles.container}>
      <div style={gaugeStyles.header}>
        <span style={{ color: 'var(--text2)', fontSize: 11, letterSpacing: 1 }}>CAPACITY</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{Math.round(used)} / {total} SP ({Math.round(pct)}%)</span>
      </div>
      <div style={gaugeStyles.track}>
        <div style={{
          ...gaugeStyles.fill,
          width: `${Math.min(pct, 100)}%`,
          background: color,
          animation: pulse ? 'gaugePulse 1s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  );
}

const gaugeStyles = {
  container: { marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontFamily: "'Press Start 2P', monospace" },
  track: { height: 14, background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 'var(--radius)', transition: 'width 0.5s ease, background 0.3s ease' },
};

// ── Priority Token Button ─────────────────────────────────────────────────────
function TokenAssigner({ tokens, maxTokens, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => onChange(Math.max(0, tokens - 1))} disabled={tokens <= 0} style={tokenBtnStyle}>−</button>
      <span style={{ color: 'var(--epic)', fontWeight: 700, fontSize: 14, minWidth: 18, textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>{tokens}</span>
      <button onClick={() => onChange(Math.min(maxTokens, tokens + 1))} disabled={tokens >= maxTokens} style={tokenBtnStyle}>+</button>
      {Array.from({ length: tokens }).map((_, i) => (
        <span key={i} style={{ color: 'var(--epic)', fontSize: 12 }}>⭐</span>
      ))}
    </div>
  );
}

const tokenBtnStyle = {
  width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};

// ── Draft Item Card ───────────────────────────────────────────────────────────
function DraftItemCard({ item, priorityScore, pick, onDraft, onSkip, onPark, capacityLeft, isGM, onOverride, disabled }) {
  const estimate = Number(item.final_estimate) || 0;
  const wontFit = estimate > 0 && estimate > capacityLeft && !pick;
  const decision = pick?.decision;

  const borderColor = decision === 'drafted' ? 'var(--jade)' : decision === 'stretch' ? 'var(--gold)' :
    decision === 'skipped' ? 'var(--text3)' : decision === 'parked' ? 'var(--text3)' : 'var(--border)';

  return (
    <div style={{
      padding: '12px 16px', background: wontFit ? 'rgba(255,255,255,0.03)' : 'var(--bg2)',
      border: `2px solid ${borderColor}`, borderRadius: 'var(--radius)',
      marginBottom: 8, opacity: wontFit ? 0.5 : decision ? 0.85 : 1,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {item.item_code && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{item.title}</span>
          </div>
          {priorityScore > 0 && (
            <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>
              ⭐ {priorityScore} priority
            </span>
          )}
        </div>
        <div style={{
          padding: '4px 10px', background: estimate ? 'var(--bg3)' : 'var(--danger)',
          borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 700,
          color: estimate ? 'var(--text)' : '#fff', fontFamily: "'Press Start 2P', monospace",
        }}>
          {estimate || '?'} SP
        </div>
      </div>

      {decision && (
        <div style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius)',
          fontSize: 10, fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace",
          background: decision === 'drafted' ? 'rgba(0,200,150,0.15)' : 'rgba(128,128,128,0.15)',
          color: decision === 'drafted' ? 'var(--jade)' : 'var(--text3)',
        }}>
          {decision === 'drafted' ? '✅ DRAFTED' : decision === 'skipped' ? '⏭️ SKIPPED' : decision === 'parked' ? '📦 PARKED' : '🔶 STRETCH'}
          {pick?.pm_override && <span style={{ marginLeft: 6, color: 'var(--gold)' }}>PM OVERRIDE</span>}
        </div>
      )}

      {wontFit && !decision && (
        <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, marginBottom: 6, fontFamily: "'Press Start 2P', monospace" }}>
          ⚠️ WON'T FIT
        </div>
      )}

      {!decision && !disabled && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onDraft} disabled={wontFit} style={{ ...actionBtn, background: wontFit ? 'var(--bg3)' : 'rgba(0,200,150,0.15)', color: wontFit ? 'var(--text3)' : 'var(--jade)', borderColor: wontFit ? 'var(--border)' : 'var(--jade)' }}>
            ✅ Draft
          </button>
          <button onClick={onSkip} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>
            ⏭️ Skip
          </button>
          <button onClick={onPark} style={{ ...actionBtn, color: 'var(--text3)', borderColor: 'var(--text3)' }}>
            📦 Park
          </button>
          {isGM && wontFit && (
            <button onClick={onOverride} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>
              🔓 Override
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtn = {
  padding: '6px 12px', border: '1px solid', background: 'transparent',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SprintDraftScreen({ sessionId, user, onBack }) {
  const [step, setStep] = useState('lobby');
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState({});
  const [priorityScores, setPriorityScores] = useState({});
  const [myTokens, setMyTokens] = useState({});
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(VOTE_TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [confidenceVotes, setConfidenceVotes] = useState({});
  const [myConfidence, setMyConfidence] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const pickOrderRef = useRef(0);

  const isGM = session?.game_master_id === user?.id;
  const capacity = session?.draft_config?.capacity_points || 0;

  const capacityUsed = useMemo(() => {
    return Object.values(picks)
      .filter(p => p.decision === 'drafted' || p.decision === 'stretch')
      .reduce((sum, p) => sum + (Number(p.estimate_at_draft) || 0), 0);
  }, [picks]);

  const capacityLeft = capacity - capacityUsed;

  const tokensUsed = useMemo(() => {
    return Object.values(myTokens).reduce((sum, t) => sum + t, 0);
  }, [myTokens]);

  const tokensRemaining = PRIORITY_TOKENS - tokensUsed;

  // Sort items by priority score
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (priorityScores[b.id] || 0) - (priorityScores[a.id] || 0));
  }, [items, priorityScores]);

  // Load draft state
  const loadState = useCallback(async () => {
    try {
      const state = await getDraftState(sessionId);
      setSession(state.session);
      setItems(state.items || []);
      setPriorityScores(state.priorityScores || {});
      // Rebuild picks map
      const pickMap = {};
      for (const p of (state.picks || [])) {
        pickMap[p.session_item_id] = p;
        if (p.pick_order >= pickOrderRef.current) pickOrderRef.current = p.pick_order + 1;
      }
      setPicks(pickMap);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadState(); }, [loadState]);

  // Load participants
  useEffect(() => {
    if (!sessionId) return;
    supabase.from('session_participants').select('id, user_id, display_name, joined_at')
      .eq('session_id', sessionId)
      .then(({ data }) => setParticipants(data || []));
  }, [sessionId]);

  // Realtime subscription for priority votes
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`draft-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_priority_votes', filter: `session_id=eq.${sessionId}` }, () => {
        // Reload scores on any change
        loadState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_picks', filter: `session_id=eq.${sessionId}` }, () => {
        loadState();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadState]);

  // Timer for priority vote
  useEffect(() => {
    if (!timerActive) return;
    if (timer <= 0) {
      setTimerActive(false);
      handleEndPriorityVote();
      return;
    }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  function handleStartPriorityVote() {
    setStep('priority');
    setTimer(VOTE_TIMER_SECONDS);
    setTimerActive(true);
  }

  async function handleEndPriorityVote() {
    setTimerActive(false);
    // Submit my tokens
    const votes = Object.entries(myTokens)
      .filter(([, t]) => t > 0)
      .map(([session_item_id, tokens]) => ({ session_item_id, tokens }));
    if (votes.length) {
      try {
        const result = await submitPriorityVotes(sessionId, votes);
        setPriorityScores(result.scores || {});
      } catch (e) {
        console.error('Priority vote error:', e);
      }
    }
    setStep('draft');
  }

  function handleTokenChange(itemId, newVal) {
    const currentUsed = tokensUsed - (myTokens[itemId] || 0);
    const maxAllowed = PRIORITY_TOKENS - currentUsed;
    const clamped = Math.max(0, Math.min(newVal, maxAllowed));
    setMyTokens(prev => ({ ...prev, [itemId]: clamped }));
  }

  async function handleDraftDecision(itemId, decision, isOverride = false) {
    const item = items.find(i => i.id === itemId);
    const estimate = Number(item?.final_estimate) || 0;
    const order = pickOrderRef.current++;
    const newPick = {
      session_item_id: itemId,
      pick_order: order,
      decision,
      estimate_at_draft: estimate,
      estimate_source: 'existing',
      voted_in: !isOverride,
      pm_override: isOverride,
      priority_score: priorityScores[itemId] || 0,
    };
    setPicks(prev => ({ ...prev, [itemId]: newPick }));
    try {
      await submitDraftPicks(sessionId, [newPick]);
    } catch (e) {
      console.error('Draft pick error:', e);
    }
  }

  function handleGoToSummary() {
    setStep('summary');
  }

  function handleConfidenceVote(vote) {
    setMyConfidence(vote);
    setConfidenceVotes(prev => ({ ...prev, [user?.id]: vote }));
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await finalizeDraft(sessionId);
      if (onBack) onBack();
    } catch (e) {
      setError(e.message);
      setFinalizing(false);
    }
  }

  // ── Render ──
  if (loading) {
    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.loading}>Loading Sprint Draft...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={screenStyles.container}>
        <div style={{ color: 'var(--danger)', padding: 32, textAlign: 'center' }}>
          <p>Error: {error}</p>
          <button onClick={onBack} style={screenStyles.backBtn}>← Back</button>
        </div>
      </div>
    );
  }

  const draftConfig = session?.draft_config || {};

  // ── Step 1: Lobby ──
  if (step === 'lobby') {
    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <button onClick={onBack} style={screenStyles.backBtn}>← Back</button>
          <h1 style={screenStyles.title}>🎯 SPRINT DRAFT</h1>
          <p style={screenStyles.subtitle}>{session?.name}</p>

          <div style={screenStyles.statRow}>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>CAPACITY</span>
              <span style={screenStyles.statValue}>{capacity} SP</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>ITEMS IN POOL</span>
              <span style={screenStyles.statValue}>{items.length}</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>PARTICIPANTS</span>
              <span style={screenStyles.statValue}>{participants.length}</span>
            </div>
          </div>

          <div style={{ margin: '16px 0', padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>JOIN CODE</p>
            <p style={{ fontSize: 18, color: 'var(--epic)', fontWeight: 700, letterSpacing: 4, fontFamily: "'Press Start 2P', monospace" }}>{session?.join_code || '—'}</p>
          </div>

          {participants.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARTICIPANTS</p>
              {participants.map(p => (
                <div key={p.id} style={{ padding: '4px 0', fontSize: 12, color: 'var(--text2)' }}>
                  {p.display_name || 'Anonymous'} {p.user_id === session?.game_master_id ? '👑' : ''}
                </div>
              ))}
            </div>
          )}

          {isGM && (
            <button onClick={handleStartPriorityVote} style={screenStyles.primaryBtn}>
              ⭐ Start Priority Vote
            </button>
          )}
          {!isGM && (
            <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
              Waiting for GM to start...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: Priority Vote ──
  if (step === 'priority') {
    const timerPct = (timer / VOTE_TIMER_SECONDS) * 100;

    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>⭐ PRIORITY VOTE</h2>
          <p style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', marginBottom: 12 }}>
            Distribute {PRIORITY_TOKENS} tokens across items you think are most important
          </p>

          {/* Timer */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: timer <= 10 ? 'var(--danger)' : 'var(--text3)', marginBottom: 4, fontFamily: "'Press Start 2P', monospace" }}>
              <span>⏱ {timer}s</span>
              <span>Tokens: {tokensRemaining} left</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${timerPct}%`,
                background: timer <= 10 ? 'var(--danger)' : 'var(--epic)',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>

          {/* Items grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {items.map(item => {
              const score = priorityScores[item.id] || 0;
              const isConsensus = score > 0 && items.length > 0;

              return (
                <div key={item.id} style={{
                  padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  animation: isConsensus && score >= 3 ? 'consensusFlash 2s ease-in-out' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.item_code && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
                      <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: '2px 0 0' }}>{item.title}</p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace", marginLeft: 8 }}>
                      {Number(item.final_estimate) || '?'} SP
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TokenAssigner
                      tokens={myTokens[item.id] || 0}
                      maxTokens={tokensRemaining + (myTokens[item.id] || 0)}
                      onChange={(val) => handleTokenChange(item.id, val)}
                    />
                    {score > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>
                        🔥 {score}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isGM && (
            <button onClick={handleEndPriorityVote} style={{ ...screenStyles.primaryBtn, marginTop: 16, background: 'var(--gold)' }}>
              End Vote Early →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Step 3: The Draft ──
  if (step === 'draft') {
    const allDecided = sortedItems.every(item => picks[item.id]);

    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>🎯 THE DRAFT</h2>

          <CapacityGauge used={capacityUsed} total={capacity} />

          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {sortedItems.map(item => (
              <DraftItemCard
                key={item.id}
                item={item}
                priorityScore={priorityScores[item.id] || 0}
                pick={picks[item.id]}
                capacityLeft={capacityLeft}
                isGM={isGM}
                disabled={false}
                onDraft={() => handleDraftDecision(item.id, 'drafted')}
                onSkip={() => handleDraftDecision(item.id, 'skipped')}
                onPark={() => handleDraftDecision(item.id, 'parked')}
                onOverride={() => handleDraftDecision(item.id, 'drafted', true)}
              />
            ))}
          </div>

          {allDecided && (
            <button onClick={handleGoToSummary} style={{ ...screenStyles.primaryBtn, marginTop: 16 }}>
              Review Summary →
            </button>
          )}
          {!allDecided && isGM && (
            <button onClick={handleGoToSummary} style={{ ...screenStyles.secondaryBtn, marginTop: 16 }}>
              Skip to Summary →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Step 4: Summary + Confidence Vote ──
  if (step === 'summary') {
    const draftedItems = sortedItems.filter(item => {
      const p = picks[item.id];
      return p && (p.decision === 'drafted' || p.decision === 'stretch');
    });
    const stretchItems = draftedItems.filter(item => picks[item.id]?.decision === 'stretch');
    const skippedItems = sortedItems.filter(item => picks[item.id]?.decision === 'skipped');
    const parkedItems = sortedItems.filter(item => picks[item.id]?.decision === 'parked');

    const totalSP = draftedItems.reduce((sum, item) => sum + (Number(item.final_estimate) || 0), 0);
    const pct = capacity > 0 ? Math.round((totalSP / capacity) * 100) : 0;

    const confidenceEntries = Object.values(confidenceVotes);
    const thumbsUp = confidenceEntries.filter(v => v === 'up').length;
    const confidencePct = confidenceEntries.length > 0 ? Math.round((thumbsUp / confidenceEntries.length) * 100) : 0;

    return (
      <div style={screenStyles.container}>
        <div style={screenStyles.panel}>
          <h2 style={screenStyles.title}>📋 SPRINT SUMMARY</h2>

          <CapacityGauge used={totalSP} total={capacity} />

          <div style={screenStyles.statRow}>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>DRAFTED</span>
              <span style={{ ...screenStyles.statValue, color: 'var(--jade)' }}>{draftedItems.length} items</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>TOTAL SP</span>
              <span style={screenStyles.statValue}>{totalSP} SP ({pct}%)</span>
            </div>
            <div style={screenStyles.stat}>
              <span style={screenStyles.statLabel}>SKIPPED</span>
              <span style={{ ...screenStyles.statValue, color: 'var(--text3)' }}>{skippedItems.length}</span>
            </div>
          </div>

          {/* Drafted items list */}
          <div style={{ margin: '16px 0' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>DRAFTED ITEMS</p>
            {draftedItems.map(item => (
              <div key={item.id} style={{
                padding: '8px 12px', marginBottom: 4,
                background: picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.08)' : 'rgba(0,200,150,0.08)',
                border: `1px solid ${picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.25)' : 'rgba(0,200,150,0.25)'}`,
                borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{item.item_code ? `${item.item_code} — ` : ''}{item.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace" }}>{Number(item.final_estimate) || '?'} SP</span>
              </div>
            ))}
            {stretchItems.length > 0 && (
              <p style={{ fontSize: 9, color: 'var(--gold)', marginTop: 4, fontFamily: "'Press Start 2P', monospace" }}>
                {stretchItems.length} stretch goal{stretchItems.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {parkedItems.length > 0 && (
            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARKED</p>
              {parkedItems.map(item => (
                <div key={item.id} style={{
                  padding: '6px 12px', marginBottom: 3, background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  fontSize: 12, color: 'var(--text3)',
                }}>
                  {item.title}
                </div>
              ))}
            </div>
          )}

          {/* Confidence Vote */}
          <div style={{ margin: '20px 0', padding: '16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, fontFamily: "'Press Start 2P', monospace" }}>CONFIDENCE VOTE</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <button onClick={() => handleConfidenceVote('up')} style={{
                ...confBtn, borderColor: myConfidence === 'up' ? 'var(--jade)' : 'var(--border)',
                background: myConfidence === 'up' ? 'rgba(0,200,150,0.15)' : 'transparent',
              }}>👍</button>
              <button onClick={() => handleConfidenceVote('down')} style={{
                ...confBtn, borderColor: myConfidence === 'down' ? 'var(--danger)' : 'var(--border)',
                background: myConfidence === 'down' ? 'rgba(255,80,80,0.15)' : 'transparent',
              }}>👎</button>
            </div>
            {confidenceEntries.length > 0 && (
              <p style={{
                fontSize: 12, fontWeight: 700, fontFamily: "'Press Start 2P', monospace",
                color: confidencePct >= 75 ? 'var(--jade)' : confidencePct >= 50 ? 'var(--gold)' : 'var(--danger)',
              }}>
                Team confidence: {confidencePct}%
              </p>
            )}
          </div>

          {/* Finalize */}
          {isGM && (
            <button onClick={handleFinalize} disabled={finalizing} style={{
              ...screenStyles.primaryBtn,
              background: finalizing ? 'var(--bg3)' : 'linear-gradient(135deg, var(--jade), #059669)',
              opacity: finalizing ? 0.6 : 1,
            }}>
              {finalizing ? '⏳ Finalizing...' : '🚀 Finalize Sprint'}
            </button>
          )}

          <button onClick={() => setStep('draft')} style={{ ...screenStyles.secondaryBtn, marginTop: 8 }}>
            ← Back to Draft
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const confBtn = {
  width: 56, height: 56, fontSize: 24, border: '2px solid',
  borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer',
};

const screenStyles = {
  container: {
    minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace", padding: '24px 16px',
  },
  panel: {
    width: '100%', maxWidth: 800, padding: '24px',
    background: 'rgba(14, 16, 25, 0.95)', border: '2px solid var(--epic)',
    boxShadow: '0 0 30px rgba(124,58,237,0.2)', borderRadius: 'var(--radius)',
  },
  title: {
    margin: '0 0 8px', fontSize: 16, color: 'var(--epic)', textAlign: 'center',
    textShadow: '0 0 10px rgba(167,139,250,0.5)', letterSpacing: 2,
  },
  subtitle: {
    margin: '0 0 20px', fontSize: 10, color: 'var(--text2)', textAlign: 'center', letterSpacing: 1,
  },
  statRow: {
    display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
  },
  stat: {
    flex: 1, minWidth: 100, padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', textAlign: 'center',
  },
  statLabel: {
    display: 'block', fontSize: 8, color: 'var(--text3)', marginBottom: 4, letterSpacing: 1,
  },
  statValue: {
    display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 700,
  },
  primaryBtn: {
    width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, var(--epic), #4f46e5)',
    border: '2px solid var(--epic)', color: '#fff', fontSize: 10, cursor: 'pointer', letterSpacing: 1,
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  secondaryBtn: {
    width: '100%', padding: '10px 16px', background: 'transparent',
    border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 9, cursor: 'pointer',
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
    fontSize: 10, fontFamily: "'Press Start 2P', monospace", marginBottom: 16,
  },
  loading: {
    color: 'var(--text2)', padding: 48, textAlign: 'center', fontSize: 12,
  },
};
