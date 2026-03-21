import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../../components/session/SessionPrimitives.jsx';
import { NPC_TEAM, C } from '../../shared/constants.js';
import { getDisplaySprites } from '../../lib/participantHelpers.js';
import { fetchRawParticipants } from '../../lib/sessionHelpers.js';
import GameXPBar from '../../components/session/GameXPBar.jsx';
import SoundToggle from '../../components/session/SoundToggle.jsx';
import { useGameSound } from '../../hooks/useGameSound.js';
import XPBadgeNotifier from '../../components/XPBadgeNotifier.jsx';
import PostSessionSummary from '../../components/session/PostSessionSummary.jsx';

import { PF, VT, STEPS } from './nsHelpers.js';
import AchievementPopup from './AchievementPopup.jsx';
import StepLobby from './StepLobby.jsx';
import StepBreakdown from './StepBreakdown.jsx';
import StepGMMerge from './StepGMMerge.jsx';
import StepQuickEstimate from './StepQuickEstimate.jsx';
import StepSumReveal from './StepSumReveal.jsx';
import StepGapAnalysis from './StepGapAnalysis.jsx';
import StepApproval from './StepApproval.jsx';

export default function NestingScopeScreen({ sessionId, user, avatar, onBack }) {
  const xpBarRef = useRef(null);
  const { soundEnabled, toggleSound } = useGameSound();
  const [step, setStep] = useState(STEPS.LOBBY);
  const [participants, setParticipants] = useState([]);
  const [item, setItem] = useState(null);
  const [isGM, setIsGM] = useState(false);
  const [mergedItems, setMergedItems] = useState([]);
  const [allEstimates, setAllEstimates] = useState({});
  const [revealTotal, setRevealTotal] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showPostSummary, setShowPostSummary] = useState(false);
  const [postSummaryData, setPostSummaryData] = useState({});
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);
  const [shaking, setShaking] = useState(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1200);
  }
  function triggerShake() { setShaking(true); setTimeout(() => setShaking(false), 500); }
  function triggerLoot() { setLootActive(true); setTimeout(() => setLootActive(false), 2000); }

  useEffect(() => {
    supabase.from('sessions').select('*, gm_id, current_item_id').eq('id', sessionId).single()
      .then(({ data }) => {
        if (!data) return;
        setIsGM(data.gm_id === user.id);
        if (data.current_item_id) {
          supabase.from('session_items').select('*').eq('id', data.current_item_id).single()
            .then(({ data: itm }) => { if (itm) setItem(itm); });
        }
      });
    fetchRawParticipants(sessionId).then(data => { if (data.length > 0) setParticipants(data); });
  }, [sessionId, user.id]);

  useEffect(() => {
    const ch = supabase.channel(`nesting-scope-${sessionId}`)
      .on('broadcast', { event: 'GAME_START' }, () => setStep(STEPS.BREAKDOWN))
      .on('broadcast', { event: 'BREAKDOWN_DONE' }, () => setStep(STEPS.GM_MERGE))
      .on('broadcast', { event: 'MERGE_DONE' }, ({ payload }) => { setMergedItems(payload.items || []); setStep(STEPS.QUICK_ESTIMATE); })
      .on('broadcast', { event: 'ESTIMATE_DONE' }, () => setStep(STEPS.SUM_REVEAL))
      .on('broadcast', { event: 'DOLL_OPEN' }, () => {})
      .on('broadcast', { event: 'GAP_READY' }, () => setStep(STEPS.GAP_ANALYSIS))
      .on('broadcast', { event: 'APPROVAL_DONE' }, () => { computeAchievements(); setShowAchievements(true); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  const computeAchievements = () => {
    const earned = [];
    const myItems = mergedItems.filter(() => true);
    if (myItems.length >= 3) earned.push({ name: 'Archaeologist', icon: '⛏️', desc: 'Found 3+ sub-items nobody else found' });
    if (item?.estimate && revealTotal < item.estimate * 0.8) earned.push({ name: 'Scope Slayer', icon: '🗡️', desc: 'Total estimate reduced by 20%+ after discussion' });
    setAchievements(earned);
  };

  const handleStart = async () => {
    await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'GAME_START', payload: {} });
    setStep(STEPS.BREAKDOWN);
  };

  const handleBreakdownSubmit = async () => {
    await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'BREAKDOWN_DONE', payload: {} });
    setStep(STEPS.GM_MERGE);
  };

  const handleMergeDone = (items) => { setMergedItems(items); setStep(STEPS.QUICK_ESTIMATE); };

  const handleEstimatesDone = async (estimates) => {
    setAllEstimates(estimates);
    await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'ESTIMATE_DONE', payload: {} });
    setStep(STEPS.SUM_REVEAL);
  };

  const handleRevealDone = async (total) => {
    setRevealTotal(total);
    await supabase.channel(`nesting-scope-${sessionId}`).send({ type: 'broadcast', event: 'GAP_READY', payload: {} });
    setStep(STEPS.GAP_ANALYSIS);
  };

  const handleApprovalDone = () => {
    computeAchievements();
    setShowAchievements(true);
    addDmg('⛏️ +XP', C.org);
    triggerShake();
    triggerLoot();
    setPostSummaryData({ subtask_count: mergedItems.length, total_estimate: revealTotal });
  };

  const stepLabel = ['', 'LOBBY', 'BREAKDOWN', 'GM MERGE', 'ESTIMATE', 'REVEAL', 'GAP', 'APPROVAL'][step];

  return (
    <Scene mc={C.org}>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '⛏️', label: '+XP', color: C.org }, { icon: '🧬', label: 'SCOPE', color: C.gld }]} />
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
        {getDisplaySprites(participants, NPC_TEAM).map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
      </div>
      {user?.id && <XPBadgeNotifier userId={user.id} />}
      {user?.id && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={user.id} ref={xpBarRef} />
        </div>
      )}
      <style>{`
        @keyframes ns-screenShake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-5px, 0); } 40% { transform: translate(5px, 0); } 60% { transform: translate(-3px, 0); } 80% { transform: translate(3px, 0); } }
        .ns-shake { animation: ns-screenShake 0.5s ease-in-out; }
        .ns-root { min-height: 100vh; background: transparent; display: flex; flex-direction: column; color: var(--text); position: relative; overflow: hidden; }
        .ns-root::before { content: ''; position: fixed; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px); pointer-events: none; z-index: 0; }
        .ns-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 2px solid var(--border); background: var(--bg2); position: relative; z-index: 1; }
        .ns-back-btn { font-family: ${PF}; font-size: 8px; color: var(--text3); background: none; border: 1px solid var(--border); padding: 6px 10px; cursor: pointer; }
        .ns-back-btn:hover { color: var(--text); border-color: var(--border2); }
        .ns-step-label { font-family: ${PF}; font-size: 7px; color: var(--text3); letter-spacing: 2px; }
        .ns-step { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 32px 20px 40px; position: relative; z-index: 1; overflow-y: auto; }
        .ns-lobby { gap: 20px; }
        .ns-btn { font-family: ${PF}; font-size: 9px; cursor: pointer; padding: 12px 20px; border: 2px solid; letter-spacing: 1px; transition: opacity 0.15s; background: transparent; }
        .ns-btn:hover { opacity: 0.8; }
        .ns-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ns-btn-primary { color: var(--jade); border-color: var(--jade); }
        .ns-btn-primary:hover { background: rgba(0,200,100,0.08); }
        .ns-btn-secondary { color: var(--text2); border-color: var(--border); }
        .ns-btn-icon { font-size: 14px; background: none; border: 1px solid var(--border); color: var(--text3); cursor: pointer; padding: 4px 8px; border-radius: 2px; }
        .ns-btn-icon:hover { border-color: var(--border2); color: var(--text); }
        .ns-btn-icon.ns-danger:hover { border-color: var(--danger); color: var(--danger); }
        .ns-btn-tag { font-family: ${VT}; font-size: 14px; background: none; border: 1px solid var(--border); color: var(--text3); cursor: pointer; padding: 3px 8px; }
        .ns-btn-tag.active { background: rgba(255,100,100,0.1); border-color: var(--danger); color: var(--danger); }
        .ns-input { font-family: ${VT}; font-size: 20px; background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; flex: 1; outline: none; }
        .ns-input:focus { border-color: var(--border2); }
        .ns-input-sm { font-size: 16px; padding: 5px 8px; }
        .ns-submitted-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 40px; border: 2px solid var(--jade); background: rgba(0,200,100,0.05); margin-top: 8px; }
        .ns-merge-row { display: flex; gap: 8px; align-items: center; padding: 8px; background: var(--bg2); border: 1px solid var(--border); }
        .ns-merge-dup { opacity: 0.45; }
        .ns-vote-card { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 72px; padding: 16px 8px; background: var(--bg2); border: 2px solid var(--border); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .ns-vote-card:hover:not(:disabled) { border-color: var(--border2); background: var(--bg3); }
        .ns-vote-card.ns-vote-selected { border-color: var(--jade); background: rgba(0,200,100,0.1); }
        .ns-vote-card.ns-vote-winner { border-color: var(--gold); background: rgba(254,174,52,0.1); }
        .ns-estimate-badge { font-family: ${VT}; font-size: 16px; background: var(--bg3); border: 1px solid var(--border); color: var(--gold); padding: 2px 8px; }
        .ns-settled-item { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; background: var(--bg2); border: 1px solid var(--border); animation: ns-itemSettle 0.4s ease-out both; }
        .ns-doll-clickable { cursor: pointer; transition: transform 0.2s; }
        .ns-doll-clickable:hover { transform: scale(1.05); }
        .ns-doll-wrapper { display: flex; align-items: center; justify-content: center; }
        .ns-bar { border: 1px solid var(--border); animation: ns-barGrow 0.6s ease-out both; transform-origin: bottom; }
        .ns-approval-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg2); border: 1px solid var(--border); cursor: pointer; }
        .ns-approval-row input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--jade); }
        .ns-celebration { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
        .ns-achievement-popup { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; animation: ns-fadeIn 0.3s ease-out; padding: 32px; text-align: center; }
        @keyframes ns-fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes ns-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ns-itemSettle { 0% { opacity: 0; transform: translateY(-40px) scale(0.7); } 60% { transform: translateY(6px) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ns-barGrow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        @keyframes ns-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
        .ns-pulse { animation: ns-pulse 1.5s ease-in-out infinite; }
        .ns-bounce { animation: ns-bounce 0.8s ease-in-out infinite; }
        .ns-doll-top-opening { animation: ns-dollOpen-top 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .ns-doll-bottom-opening { animation: ns-dollOpen-bottom 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        @keyframes ns-dollOpen-top { 0% { transform: translateY(0) rotate(0deg); } 40% { transform: translateY(-10%) rotate(-3deg); } 100% { transform: translateY(-120%) rotate(-8deg); } }
        @keyframes ns-dollOpen-bottom { 0% { transform: scaleX(1); } 100% { transform: scaleX(1.1); } }
      `}</style>

      <div className={`ns-root${shaking ? ' ns-shake' : ''}`}>
        <div className="ns-header">
          <button className="ns-back-btn" onClick={onBack}>← BACK</button>
          <div style={{ flex: 1 }} />
          <span className="ns-step-label">STEP {step}/7 · {stepLabel}</span>
          {isGM && <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--gold)', marginLeft: 12 }}>GM</span>}
        </div>

        {step === STEPS.LOBBY && <StepLobby sessionId={sessionId} user={user} avatar={avatar} participants={participants} item={item} isGM={isGM} onStart={handleStart} />}
        {step === STEPS.BREAKDOWN && <StepBreakdown sessionId={sessionId} user={user} item={item} participants={participants} onSubmit={handleBreakdownSubmit} />}
        {step === STEPS.GM_MERGE && <StepGMMerge sessionId={sessionId} item={item} isGM={isGM} onMergeDone={handleMergeDone} />}
        {step === STEPS.QUICK_ESTIMATE && <StepQuickEstimate sessionId={sessionId} user={user} item={item} mergedItems={mergedItems} participants={participants} onAllDone={handleEstimatesDone} />}
        {step === STEPS.SUM_REVEAL && <StepSumReveal sessionId={sessionId} mergedItems={mergedItems} allEstimates={allEstimates} item={item} isGM={isGM} onDone={handleRevealDone} />}
        {step === STEPS.GAP_ANALYSIS && <StepGapAnalysis item={item} mergedItems={mergedItems} allEstimates={allEstimates} total={revealTotal} onContinue={() => setStep(STEPS.APPROVAL)} />}
        {step === STEPS.APPROVAL && <StepApproval sessionId={sessionId} user={user} item={item} mergedItems={mergedItems} allEstimates={allEstimates} isGM={isGM} onDone={handleApprovalDone} />}

        {showAchievements && achievements.length > 0 && (
          <AchievementPopup achievements={achievements} onDone={() => { setShowAchievements(false); setShowPostSummary(true); }} />
        )}

        {showPostSummary && !showAchievements && (
          <PostSessionSummary sessionType="nesting_scope" results={postSummaryData} approvalPending={false} approvalItems={[]} onBack={onBack} sessionId={sessionId} />
        )}
      </div>
    </Scene>
  );
}
