import { handleSoftError } from '../../lib/errorHandler';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getDraftState, submitDraftPicks, submitPriorityVotes, finalizeDraft } from '../../lib/api';
import { fetchRawParticipants } from '../../lib/sessionHelpers.js';
import { Scene, Sprite, DmgNum, LootDrops } from '../../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../../shared/constants.js';
import GameXPBar from '../../components/session/GameXPBar.jsx';
import SoundToggle from '../../components/session/SoundToggle.jsx';
import { useGameSound } from '../../hooks/useGameSound.js';
import XPBadgeNotifier from '../../components/XPBadgeNotifier.jsx';

import { injectDraftStyles } from './sdStyles.js';
import { playCoin, playFanfare } from './sdAudio.js';
import { PRIORITY_TOKENS, VOTE_TIMER_SECONDS, screenStyles } from './sdConstants.js';
import { QuickEstimateModal, ConfettiBurst, SprintCelebration, CapacityGauge, TokenAssigner, DraftItemCard } from './DraftComponents.jsx';
import { cornerControls } from '../../shared/styles.js';

export default function SprintDraftScreen({ sessionId, user, onBack }) {
  useEffect(() => { injectDraftStyles(); }, []);
  const { soundEnabled, toggleSound } = useGameSound();
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [mysteryFlipItem, setMysteryFlipItem] = useState(null);
  const [revealAnims, setRevealAnims] = useState({});
  const [overflowFlash, setOverflowFlash] = useState(false);
  const [consensusItems, setConsensusItems] = useState({});
  const timerRef = useRef(null);
  const pickOrderRef = useRef(0);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [flashClass, setFlashClass] = useState('');
  const perfectFillTriggered = useRef(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1400);
  }
  function triggerShake() { setShaking(true); setTimeout(() => setShaking(false), 500); }
  function triggerFlash(cls) { setFlashClass(cls); setTimeout(() => setFlashClass(''), 700); }

  const isGM = session?.game_master_id === user?.id;
  const capacity = session?.draft_config?.capacity_points || 0;

  const capacityUsed = useMemo(() => Object.values(picks).filter(p => p.decision === 'drafted' || p.decision === 'stretch').reduce((sum, p) => sum + (Number(p.estimate_at_draft) || 0), 0), [picks]);
  const capacityLeft = capacity - capacityUsed;
  const capacityPct = capacity > 0 ? Math.round((capacityUsed / capacity) * 100) : 0;
  const tokensUsed = useMemo(() => Object.values(myTokens).reduce((sum, t) => sum + t, 0), [myTokens]);
  const tokensRemaining = PRIORITY_TOKENS - tokensUsed;

  const totalTokensDistributed = useMemo(() => Object.values(priorityScores).reduce((sum, s) => sum + s, 0), [priorityScores]);

  useEffect(() => {
    if (totalTokensDistributed === 0) return;
    const newConsensus = {};
    for (const [itemId, score] of Object.entries(priorityScores)) {
      if (score / totalTokensDistributed > 0.7) newConsensus[itemId] = true;
    }
    setConsensusItems(newConsensus);
  }, [priorityScores, totalTokensDistributed]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => (priorityScores[b.id] || 0) - (priorityScores[a.id] || 0)), [items, priorityScores]);

  const loadState = useCallback(async () => {
    try {
      const state = await getDraftState(sessionId);
      setSession(state.session);
      setItems(state.items || []);
      setPriorityScores(state.priorityScores || {});
      const pickMap = {};
      for (const p of (state.picks || [])) {
        pickMap[p.session_item_id] = p;
        if (p.pick_order >= pickOrderRef.current) pickOrderRef.current = p.pick_order + 1;
      }
      setPicks(pickMap);
      setLoading(false);
    } catch (err) { setError(err.message); setLoading(false); }
  }, [sessionId]);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    if (!sessionId) return;
    fetchRawParticipants(sessionId).then(data => setParticipants(data));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`draft-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_priority_votes', filter: `session_id=eq.${sessionId}` }, () => { loadState(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_draft_picks', filter: `session_id=eq.${sessionId}` }, () => { loadState(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadState]);

  useEffect(() => {
    if (!timerActive) return;
    if (timer <= 0) { setTimerActive(false); handleEndPriorityVote(); return; }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timer]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStartPriorityVote() { setStep('priority'); setTimer(VOTE_TIMER_SECONDS); setTimerActive(true); }

  async function handleEndPriorityVote() {
    setTimerActive(false);
    const votes = Object.entries(myTokens).filter(([, t]) => t > 0).map(([session_item_id, tokens]) => ({ session_item_id, tokens }));
    if (votes.length) {
      try { const result = await submitPriorityVotes(sessionId, votes); setPriorityScores(result.scores || {}); }
      catch (e) { console.error('Priority vote error:', e); }
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
    const estimate = Number(item?.final_estimate) || Number(item?.estimated_hours) || 0;
    if (decision === 'drafted' && !isOverride && estimate > 0 && estimate > capacityLeft) {
      setOverflowFlash(true);
      setTimeout(() => setOverflowFlash(false), 600);
      addDmg('⚠️ Over capacity!', C.red);
      triggerShake();
      triggerFlash('sd-flash-red');
      return;
    }
    const order = pickOrderRef.current++;
    const newPick = { session_item_id: itemId, pick_order: order, decision, estimate_at_draft: estimate, estimate_source: revealAnims[itemId] ? 'quick' : 'existing', voted_in: !isOverride, pm_override: isOverride, priority_score: priorityScores[itemId] || 0 };
    setPicks(prev => ({ ...prev, [itemId]: newPick }));
    try {
      await submitDraftPicks(sessionId, [newPick]);
      if (decision === 'drafted') { addDmg('+1 drafted', C.grn); playCoin(); }
    } catch (e) { console.error('Draft pick error:', e); }
  }

  function handleMysteryFlip(item) { setMysteryFlipItem(item); }

  function handleQuickEstimate(estimateValue) {
    if (!mysteryFlipItem) return;
    const itemId = mysteryFlipItem.id;
    setMysteryFlipItem(null);
    setRevealAnims(prev => ({ ...prev, [itemId]: 'flipping' }));
    setTimeout(() => {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, final_estimate: estimateValue, estimated_hours: estimateValue } : it));
      setTimeout(() => {
        const anim = estimateValue <= 5 ? 'small' : estimateValue >= 13 ? 'big' : null;
        setRevealAnims(prev => ({ ...prev, [itemId]: anim }));
        setTimeout(() => { setRevealAnims(prev => ({ ...prev, [itemId]: null })); }, 1500);
      }, 500);
    }, 600);
  }

  function handleGoToSummary() { setStep('summary'); }
  function handleConfidenceVote(vote) { setMyConfidence(vote); setConfidenceVotes(prev => ({ ...prev, [user?.id]: vote })); }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await finalizeDraft(sessionId);
      triggerFlash('sd-flash-green');
      setLootActive(true); setTimeout(() => setLootActive(false), 2000);
      playFanfare();
      if (capacityPct >= 98 && capacityPct <= 102 && user?.id && !perfectFillTriggered.current) {
        perfectFillTriggered.current = true;
        supabase.from('achievement_unlocks').insert({ user_id: user.id, achievement_key: 'perfect_fill', session_id: sessionId, xp_awarded: 50 }).then(() => {}).catch(() => {});
      }
      setShowCelebration(true);
    } catch (e) { setError(e.message); setFinalizing(false); }
  }

  const draftGameSoul = (
    <>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '🎯', label: 'DRAFT', color: C.gld }, { icon: '✅', label: 'DONE', color: C.grn }]} />
      </div>
      {user?.id && <XPBadgeNotifier userId={user.id} />}
      {user?.id && (
        <div style={cornerControls}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={user.id} />
        </div>
      )}
    </>
  );

  if (loading) return <Scene mc="#f59e0b">{draftGameSoul}<div style={screenStyles.container}><div style={screenStyles.loading}>Loading Sprint Draft...</div></div></Scene>;
  if (error && !showCelebration) return <div style={screenStyles.container}><div style={{ color: 'var(--danger)', padding: 32, textAlign: 'center' }}><p>Error: {error}</p><button onClick={onBack} style={screenStyles.backBtn}>← Back</button></div></div>;
  if (showCelebration) return <SprintCelebration sprintName={session?.name} capacityPct={capacityPct} participants={participants} onDone={() => { if (onBack) onBack(); }} />;

  // ── Step 1: Lobby ──
  if (step === 'lobby') {
    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
        <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
          <div style={screenStyles.panel}>
            <button onClick={onBack} style={screenStyles.backBtn}>← Back</button>
            <h1 style={screenStyles.title}>🎯 SPRINT DRAFT</h1>
            <p style={screenStyles.subtitle}>{session?.name}</p>
            <div style={screenStyles.statRow}>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>CAPACITY</span><span style={screenStyles.statValue}>{capacity} SP</span></div>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>ITEMS IN POOL</span><span style={screenStyles.statValue}>{items.length}</span></div>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>PARTICIPANTS</span><span style={screenStyles.statValue}>{participants.length}</span></div>
            </div>
            <div style={{ margin: '16px 0', padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>JOIN CODE</p>
              <p style={{ fontSize: 18, color: 'var(--epic)', fontWeight: 700, letterSpacing: 4, fontFamily: "'Press Start 2P', monospace" }}>{session?.join_code || '—'}</p>
            </div>
            {participants.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARTICIPANTS</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                  {participants.map((p, i) => (
                    <Sprite key={p.id} m={{ name: (p.display_name || 'Anon').split(' ')[0], cls: CLASSES[i % CLASSES.length], lv: 3, hat: CLASSES[i % CLASSES.length].color, body: CLASSES[i % CLASSES.length].color, skin: '#fdd' }} size={1.0} idle />
                  ))}
                </div>
                {participants.map(p => (
                  <div key={p.id} style={{ padding: '4px 0', fontSize: 12, color: 'var(--text2)' }}>{p.display_name || 'Anonymous'} {p.user_id === session?.game_master_id ? '👑' : ''}</div>
                ))}
              </div>
            )}
            {isGM && <button onClick={handleStartPriorityVote} style={screenStyles.primaryBtn}>⭐ Start Priority Vote</button>}
            {!isGM && <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>Waiting for GM to start...</p>}
          </div>
        </div>
      </Scene>
    );
  }

  // ── Step 2: Priority Vote ──
  if (step === 'priority') {
    const timerPct = (timer / VOTE_TIMER_SECONDS) * 100;
    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
        <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
          <div style={screenStyles.panel}>
            <h2 style={screenStyles.title}>⭐ PRIORITY VOTE</h2>
            <p style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', marginBottom: 12 }}>Distribute {PRIORITY_TOKENS} tokens across items you think are most important</p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: timer <= 10 ? 'var(--danger)' : 'var(--text3)', marginBottom: 4, fontFamily: "'Press Start 2P', monospace" }}>
                <span>⏱ {timer}s</span><span>Tokens: {tokensRemaining} left</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${timerPct}%`, background: timer <= 10 ? 'var(--danger)' : 'var(--epic)', transition: 'width 1s linear' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {items.map(item => {
                const score = priorityScores[item.id] || 0;
                const isConsensus = consensusItems[item.id];
                return (
                  <div key={item.id} style={{ padding: '12px', background: 'var(--bg2)', border: isConsensus ? '2px solid var(--gold)' : '1px solid var(--border)', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden', animation: isConsensus ? 'consensusGlow 2s ease-in-out' : 'none' }}>
                    {isConsensus && <ConfettiBurst active />}
                    {isConsensus && <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 8, color: 'var(--gold)', fontFamily: "'Press Start 2P', monospace", fontWeight: 700 }}>🔥 HIGH PRIORITY</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {item.item_code && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Press Start 2P', monospace" }}>{item.item_code}</span>}
                        <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: '2px 0 0' }}>{item.title}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace", marginLeft: 8 }}>{Number(item.final_estimate) || '?'} SP</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TokenAssigner tokens={myTokens[item.id] || 0} maxTokens={tokensRemaining + (myTokens[item.id] || 0)} onChange={(val) => handleTokenChange(item.id, val)} />
                      {score > 0 && <span style={{ fontSize: 10, color: 'var(--epic)', fontFamily: "'Press Start 2P', monospace" }}>🔥 {score}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {isGM && <button onClick={handleEndPriorityVote} style={{ ...screenStyles.primaryBtn, marginTop: 16, background: 'var(--gold)', color: '#000' }}>End Vote Early →</button>}
          </div>
        </div>
      </Scene>
    );
  }

  // ── Step 3: The Draft ──
  if (step === 'draft') {
    const allDecided = sortedItems.every(item => picks[item.id]);
    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
        <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
          <div style={screenStyles.panel}>
            <h2 style={screenStyles.title}>🎯 THE DRAFT</h2>
            <CapacityGauge used={capacityUsed} total={capacity} overflowFlash={overflowFlash} />
            <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {sortedItems.map(item => (
                <DraftItemCard key={item.id} item={item} priorityScore={priorityScores[item.id] || 0} pick={picks[item.id]} capacityLeft={capacityLeft} isGM={isGM} disabled={false} revealAnim={revealAnims[item.id]} onDraft={() => handleDraftDecision(item.id, 'drafted')} onSkip={() => handleDraftDecision(item.id, 'skipped')} onPark={() => handleDraftDecision(item.id, 'parked')} onOverride={() => handleDraftDecision(item.id, 'drafted', true)} onFlipMystery={() => handleMysteryFlip(item)} />
              ))}
            </div>
            {allDecided && <button onClick={handleGoToSummary} style={{ ...screenStyles.primaryBtn, marginTop: 16 }}>Review Summary →</button>}
            {!allDecided && isGM && <button onClick={handleGoToSummary} style={{ ...screenStyles.secondaryBtn, marginTop: 16 }}>Skip to Summary →</button>}
          </div>
          {mysteryFlipItem && <QuickEstimateModal item={mysteryFlipItem} onEstimate={handleQuickEstimate} onCancel={() => setMysteryFlipItem(null)} />}
        </div>
      </Scene>
    );
  }

  // ── Step 4: Summary ──
  if (step === 'summary') {
    const draftedItems = sortedItems.filter(item => { const p = picks[item.id]; return p && (p.decision === 'drafted' || p.decision === 'stretch'); });
    const stretchItems = draftedItems.filter(item => picks[item.id]?.decision === 'stretch');
    const skippedItems = sortedItems.filter(item => picks[item.id]?.decision === 'skipped');
    const parkedItems = sortedItems.filter(item => picks[item.id]?.decision === 'parked');
    const totalSP = draftedItems.reduce((sum, item) => sum + (Number(item.final_estimate) || Number(item.estimated_hours) || 0), 0);
    const pct = capacity > 0 ? Math.round((totalSP / capacity) * 100) : 0;
    const confidenceEntries = Object.values(confidenceVotes);
    const thumbsUp = confidenceEntries.filter(v => v === 'up').length;
    const confidencePct = confidenceEntries.length > 0 ? Math.round((thumbsUp / confidenceEntries.length) * 100) : 0;
    const confBtn = { width: 56, height: 56, fontSize: 24, border: '2px solid', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' };

    return (
      <Scene mc="#f59e0b">
        {draftGameSoul}
        <div className={`${shaking ? 'sd-shake' : ''} ${flashClass}`} style={screenStyles.container}>
          <div style={screenStyles.panel}>
            <h2 style={screenStyles.title}>📋 SPRINT SUMMARY</h2>
            <CapacityGauge used={totalSP} total={capacity} />
            <div style={screenStyles.statRow}>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>DRAFTED</span><span style={{ ...screenStyles.statValue, color: 'var(--jade)' }}>{draftedItems.length} items</span></div>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>TOTAL SP</span><span style={screenStyles.statValue}>{totalSP} SP ({pct}%)</span></div>
              <div style={screenStyles.stat}><span style={screenStyles.statLabel}>SKIPPED</span><span style={{ ...screenStyles.statValue, color: 'var(--text3)' }}>{skippedItems.length}</span></div>
            </div>
            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>DRAFTED ITEMS</p>
              {draftedItems.map(item => (
                <div key={item.id} style={{ padding: '8px 12px', marginBottom: 4, background: picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.08)' : 'rgba(0,200,150,0.08)', border: `1px solid ${picks[item.id]?.decision === 'stretch' ? 'rgba(200,168,75,0.25)' : 'rgba(0,200,150,0.25)'}`, borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{item.item_code ? `${item.item_code} — ` : ''}{item.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'Press Start 2P', monospace" }}>{Number(item.final_estimate) || Number(item.estimated_hours) || '?'} SP</span>
                </div>
              ))}
              {stretchItems.length > 0 && <p style={{ fontSize: 9, color: 'var(--gold)', marginTop: 4, fontFamily: "'Press Start 2P', monospace" }}>{stretchItems.length} stretch goal{stretchItems.length > 1 ? 's' : ''}</p>}
            </div>
            {parkedItems.length > 0 && (
              <div style={{ margin: '16px 0' }}>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>PARKED</p>
                {parkedItems.map(item => <div key={item.id} style={{ padding: '6px 12px', marginBottom: 3, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)' }}>{item.title}</div>)}
              </div>
            )}
            <div style={{ margin: '20px 0', padding: '16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, fontFamily: "'Press Start 2P', monospace" }}>CONFIDENCE VOTE</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                <button onClick={() => handleConfidenceVote('up')} style={{ ...confBtn, borderColor: myConfidence === 'up' ? 'var(--jade)' : 'var(--border)', background: myConfidence === 'up' ? 'rgba(0,200,150,0.15)' : 'transparent' }}>👍</button>
                <button onClick={() => handleConfidenceVote('down')} style={{ ...confBtn, borderColor: myConfidence === 'down' ? 'var(--danger)' : 'var(--border)', background: myConfidence === 'down' ? 'rgba(255,80,80,0.15)' : 'transparent' }}>👎</button>
              </div>
              {confidenceEntries.length > 0 && <p style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Press Start 2P', monospace", color: confidencePct >= 75 ? 'var(--jade)' : confidencePct >= 50 ? 'var(--gold)' : 'var(--danger)' }}>Team confidence: {confidencePct}%</p>}
            </div>
            {isGM && <button onClick={handleFinalize} disabled={finalizing} style={{ ...screenStyles.primaryBtn, background: finalizing ? 'var(--bg3)' : 'linear-gradient(135deg, var(--jade), #059669)', opacity: finalizing ? 0.6 : 1 }}>{finalizing ? '⏳ Finalizing...' : '🚀 Finalize Sprint'}</button>}
            <button onClick={() => setStep('draft')} style={{ ...screenStyles.secondaryBtn, marginTop: 8 }}>← Back to Draft</button>
          </div>
        </div>
      </Scene>
    );
  }

  return null;
}
